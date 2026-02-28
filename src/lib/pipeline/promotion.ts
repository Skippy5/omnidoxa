/**
 * OmniDoxa Pipeline - Promotion Module
 * 
 * Promotes staged articles to live tables using UPSERT pattern
 * 
 * CRITICAL FEATURES:
 * - Turso transactions (BEGIN → UPSERTs → COMMIT)
 * - UPSERT pattern (not delete→insert)
 * - Pre/post promotion validation
 * - Rollback on error
 * 
 * Phase: 1.11 - Promotion Module
 * Created: 2026-02-28
 */

import { turso } from '../db-turso';
import type { Category } from '../types';

/**
 * Pre-promotion validation
 */
async function validateBeforePromotion(runId: number, categories?: Category[]): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  
  // Check run exists and is in valid state
  const runResult = await turso.execute({
    sql: 'SELECT status FROM pipeline_runs WHERE id = ?',
    args: [runId]
  });
  
  if (runResult.rows.length === 0) {
    errors.push(`Run ${runId} not found`);
    return { valid: false, errors };
  }
  
  const runStatus = runResult.rows[0].status as string;
  if (!['running', 'analyzing', 'promoting'].includes(runStatus)) {
    errors.push(`Run ${runId} has invalid status: ${runStatus}`);
  }
  
  // Check selected articles exist
  let sql = `SELECT COUNT(*) as count FROM staging_articles WHERE run_id = ? AND status = 'selected'`;
  const args: any[] = [runId];
  
  if (categories && categories.length > 0) {
    const placeholders = categories.map(() => '?').join(',');
    sql += ` AND category IN (${placeholders})`;
    args.push(...categories);
  }
  
  const countResult = await turso.execute({ sql, args });
  const selectedCount = (countResult.rows[0] as any).count as number;
  
  if (selectedCount === 0) {
    errors.push('No selected articles to promote');
  }
  
  // Check analysis jobs are complete (if any exist)
  const jobsResult = await turso.execute({
    sql: `SELECT COUNT(*) as count FROM analysis_jobs 
          WHERE run_id = ? AND status NOT IN ('complete', 'skipped')`,
    args: [runId]
  });
  
  const incompleteJobs = (jobsResult.rows[0] as any).count as number;
  if (incompleteJobs > 0) {
    errors.push(`${incompleteJobs} analysis jobs still incomplete`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Post-promotion validation
 */
async function validateAfterPromotion(runId: number, expectedCount: number): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  
  // Verify promoted articles exist in live tables
  const liveResult = await turso.execute({
    sql: `SELECT COUNT(DISTINCT s.id) as count
          FROM stories s
          WHERE EXISTS (
            SELECT 1 FROM staging_articles sa
            WHERE sa.run_id = ? AND sa.status = 'selected' AND sa.url = s.url
          )`,
    args: [runId]
  });
  
  const liveCount = (liveResult.rows[0] as any).count as number;
  
  if (liveCount !== expectedCount) {
    errors.push(`Expected ${expectedCount} live stories, found ${liveCount}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Promote staging articles to live tables
 * Uses UPSERT pattern with Turso batch transactions
 */
export async function promoteToLive(
  runId: number,
  categories?: Category[]
): Promise<{
  success: boolean;
  promoted: {
    stories: number;
    viewpoints: number;
    socialPosts: number;
  };
  errors: string[];
}> {
  console.log(`[Promotion] Starting promotion for run ${runId}${categories ? ` (categories: ${categories.join(', ')})` : ''}...`);
  
  // Pre-promotion validation
  const preValidation = await validateBeforePromotion(runId, categories);
  if (!preValidation.valid) {
    console.error('[Promotion] Pre-validation failed:', preValidation.errors);
    return {
      success: false,
      promoted: { stories: 0, viewpoints: 0, socialPosts: 0 },
      errors: preValidation.errors
    };
  }
  
  try {
    // Fetch selected articles with viewpoints and social posts
    let articlesSql = `SELECT * FROM staging_articles WHERE run_id = ? AND status = 'selected'`;
    const articlesArgs: any[] = [runId];
    
    if (categories && categories.length > 0) {
      const placeholders = categories.map(() => '?').join(',');
      articlesSql += ` AND category IN (${placeholders})`;
      articlesArgs.push(...categories);
    }
    
    const articlesResult = await turso.execute({ sql: articlesSql, args: articlesArgs });
    const articles = articlesResult.rows as any[];
    
    console.log(`[Promotion] Found ${articles.length} articles to promote`);
    
    if (articles.length === 0) {
      return {
        success: true,
        promoted: { stories: 0, viewpoints: 0, socialPosts: 0 },
        errors: []
      };
    }
    
    // Build transaction batch
    // NOTE: Turso batch() already wraps statements in a transaction
    // Do NOT add explicit BEGIN/COMMIT
    const batchStatements: Array<{ sql: string; args?: any[] }> = [];
    
    let promotedStories = 0;
    let promotedViewpoints = 0;
    let promotedSocialPosts = 0;
    
    // UPSERT stories
    for (const article of articles) {
      batchStatements.push({
        sql: `INSERT INTO stories (title, description, url, source, image_url, category, published_at, fetched_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(url) DO UPDATE SET
                title = excluded.title,
                description = excluded.description,
                source = excluded.source,
                image_url = excluded.image_url,
                category = excluded.category,
                published_at = excluded.published_at,
                fetched_at = excluded.fetched_at,
                updated_at = datetime('now')`,
        args: [
          article.title,
          article.description,
          article.url,
          article.source,
          article.image_url,
          article.category,
          article.published_at,
          article.fetched_at
        ]
      });
      promotedStories++;
      
      // Fetch viewpoints for this article
      const viewpointsResult = await turso.execute({
        sql: 'SELECT * FROM staging_viewpoints WHERE run_id = ? AND article_id = ?',
        args: [runId, article.id]
      });
      
      const viewpoints = viewpointsResult.rows as any[];
      
      for (const viewpoint of viewpoints) {
        // UPSERT viewpoints (requires story_id from live table)
        // We use a subquery to get the story_id from the live table
        batchStatements.push({
          sql: `INSERT INTO viewpoints (story_id, lean, summary, sentiment_score)
                VALUES ((SELECT id FROM stories WHERE url = ?), ?, ?, ?)
                ON CONFLICT(story_id, lean) DO UPDATE SET
                  summary = excluded.summary,
                  sentiment_score = excluded.sentiment_score,
                  updated_at = datetime('now')`,
          args: [
            article.url,
            viewpoint.lean,
            viewpoint.summary,
            viewpoint.sentiment_score
          ]
        });
        promotedViewpoints++;
        
        // Fetch social posts for this viewpoint
        const postsResult = await turso.execute({
          sql: 'SELECT * FROM staging_social_posts WHERE run_id = ? AND viewpoint_id = ?',
          args: [runId, viewpoint.id]
        });
        
        const posts = postsResult.rows as any[];
        
        for (const post of posts) {
          // UPSERT social posts
          batchStatements.push({
            sql: `INSERT INTO social_posts (viewpoint_id, author, author_handle, text, url, platform, likes, retweets, is_real, post_date)
                  VALUES (
                    (SELECT v.id FROM viewpoints v 
                     JOIN stories s ON v.story_id = s.id 
                     WHERE s.url = ? AND v.lean = ?),
                    ?, ?, ?, ?, ?, ?, ?, ?, ?
                  )
                  ON CONFLICT(platform_id, platform) DO UPDATE SET
                    author = excluded.author,
                    author_handle = excluded.author_handle,
                    text = excluded.text,
                    url = excluded.url,
                    likes = excluded.likes,
                    retweets = excluded.retweets,
                    is_real = excluded.is_real,
                    post_date = excluded.post_date,
                    updated_at = datetime('now')`,
            args: [
              article.url,
              viewpoint.lean,
              post.author,
              post.author || 'Unknown',
              post.content,
              post.url,
              post.source,
              post.likes,
              post.retweets,
              post.is_real,
              post.timestamp
            ]
          });
          promotedSocialPosts++;
        }
      }
    }
    
    console.log(`[Promotion] Executing transaction with ${batchStatements.length} statements...`);
    
    // Execute batch transaction
    await turso.batch(batchStatements);
    
    console.log(`[Promotion] ✅ Transaction committed successfully`);
    
    // Post-promotion validation
    const postValidation = await validateAfterPromotion(runId, articles.length);
    if (!postValidation.valid) {
      console.warn('[Promotion] ⚠️ Post-validation warnings:', postValidation.errors);
      // Don't fail - data is already committed
    }
    
    // Update run status
    await turso.execute({
      sql: `UPDATE pipeline_runs 
            SET status = 'complete', 
                current_stage = 'promotion_complete', 
                completed_at = datetime('now') 
            WHERE id = ?`,
      args: [runId]
    });
    
    console.log(`[Promotion] ✅ Promoted ${promotedStories} stories, ${promotedViewpoints} viewpoints, ${promotedSocialPosts} social posts`);
    
    return {
      success: true,
      promoted: {
        stories: promotedStories,
        viewpoints: promotedViewpoints,
        socialPosts: promotedSocialPosts
      },
      errors: []
    };
    
  } catch (error: any) {
    console.error('[Promotion] ❌ Transaction failed:', error);
    
    // Attempt rollback (Turso handles this automatically on batch failure)
    try {
      await turso.execute({ sql: 'ROLLBACK' });
      console.log('[Promotion] Rollback successful');
    } catch (rollbackError) {
      console.error('[Promotion] Rollback failed (may have auto-rolled back):', rollbackError);
    }
    
    // Update run status to failed
    await turso.execute({
      sql: `UPDATE pipeline_runs 
            SET status = 'failed', 
                error_message = ?, 
                completed_at = datetime('now') 
            WHERE id = ?`,
      args: [error.message, runId]
    });
    
    return {
      success: false,
      promoted: { stories: 0, viewpoints: 0, socialPosts: 0 },
      errors: [error.message]
    };
  }
}

/**
 * Get promotion summary for a run
 */
export async function getPromotionSummary(runId: number): Promise<{
  selectedArticles: number;
  promotedStories: number;
  promotedViewpoints: number;
  promotedSocialPosts: number;
}> {
  const [selectedResult, storiesResult, viewpointsResult, postsResult] = await Promise.all([
    turso.execute({
      sql: 'SELECT COUNT(*) as count FROM staging_articles WHERE run_id = ? AND status = ?',
      args: [runId, 'selected']
    }),
    turso.execute({
      sql: `SELECT COUNT(DISTINCT s.id) as count
            FROM stories s
            WHERE EXISTS (
              SELECT 1 FROM staging_articles sa
              WHERE sa.run_id = ? AND sa.status = 'selected' AND sa.url = s.url
            )`,
      args: [runId]
    }),
    turso.execute({
      sql: `SELECT COUNT(*) as count FROM viewpoints v
            WHERE EXISTS (
              SELECT 1 FROM staging_viewpoints sv
              JOIN staging_articles sa ON sv.article_id = sa.id
              WHERE sv.run_id = ? AND sa.status = 'selected'
            )`,
      args: [runId]
    }),
    turso.execute({
      sql: `SELECT COUNT(*) as count FROM social_posts sp
            WHERE EXISTS (
              SELECT 1 FROM staging_social_posts ssp
              JOIN staging_articles sa ON ssp.article_id = sa.id
              WHERE ssp.run_id = ? AND sa.status = 'selected'
            )`,
      args: [runId]
    })
  ]);
  
  return {
    selectedArticles: (selectedResult.rows[0] as any).count || 0,
    promotedStories: (storiesResult.rows[0] as any).count || 0,
    promotedViewpoints: (viewpointsResult.rows[0] as any).count || 0,
    promotedSocialPosts: (postsResult.rows[0] as any).count || 0
  };
}
