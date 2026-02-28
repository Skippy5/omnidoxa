/**
 * Re-Analysis Module
 * 
 * Re-analyzes existing live articles WITHOUT re-fetching from Newsdata.io
 * Updates live database directly (no staging round-trip)
 * 
 * Use Cases:
 * - "Re-run sentiment analysis on political articles"
 * - "Update Twitter analysis on breaking news category"
 * - "Refresh viewpoints for specific article IDs"
 * 
 * Phase: 3.1 - Re-Analysis Capability
 * Created: 2026-02-28
 */

import { turso } from '../db-turso';
import { analyzeArticleTwitter } from './analysis/twitter';
import type { TwitterAnalysisResult } from './analysis/twitter';

// ============================================================================
// TYPES
// ============================================================================

export type AnalysisType = 'twitter' | 'reddit' | 'ai_sentiment';

export interface ReanalysisFilter {
  articleIds?: number[];       // Specific article IDs
  categories?: string[];        // All articles in categories
  dateRange?: { from: string; to: string; };  // Articles by date
}

export interface ReanalysisResult {
  articlesProcessed: number;
  viewpointsUpdated: number;
  socialPostsUpdated: number;
  errors: Array<{ articleId: number; error: string }>;
}

interface LiveArticle {
  id: number;
  category: string;
  title: string;
  description: string | null;
  url: string;
  source: string;
  image_url: string | null;
  published_at: string | null;
  created_at: string;
}

interface StagingArticle {
  id: number;
  run_id: number;
  category: string;
  title: string;
  description: string | null;
  url: string;
  source: string;
  image_url: string | null;
  published_at: string | null;
  fetched_at: string;
}

// ============================================================================
// MAIN RE-ANALYSIS FUNCTION
// ============================================================================

/**
 * Re-analyze existing live articles with specified analysis types
 * Updates live database directly (no staging round-trip)
 * 
 * @param filter - Which articles to re-analyze
 * @param analysisTypes - Which analysis to run (twitter, reddit, ai_sentiment)
 * @returns Results summary
 * 
 * @example
 * ```typescript
 * // Re-analyze all political articles with Twitter analysis
 * const result = await reanalyzeArticles(
 *   { categories: ['politics'] },
 *   ['twitter']
 * );
 * 
 * // Re-analyze specific articles
 * const result = await reanalyzeArticles(
 *   { articleIds: [42, 43, 44] },
 *   ['twitter', 'ai_sentiment']
 * );
 * ```
 */
export async function reanalyzeArticles(
  filter: ReanalysisFilter,
  analysisTypes: AnalysisType[]
): Promise<ReanalysisResult> {
  console.log('[ReAnalysis] Starting re-analysis...');
  console.log('[ReAnalysis] Filter:', filter);
  console.log('[ReAnalysis] Analysis types:', analysisTypes);

  const result: ReanalysisResult = {
    articlesProcessed: 0,
    viewpointsUpdated: 0,
    socialPostsUpdated: 0,
    errors: []
  };

  // 1. Fetch live articles based on filter
  const articles = await fetchLiveArticles(filter);
  console.log(`[ReAnalysis] Found ${articles.length} articles to re-analyze`);

  if (articles.length === 0) {
    console.log('[ReAnalysis] No articles match filter - nothing to do');
    return result;
  }

  // 2. Create a temporary pipeline run for staging context
  const tempRunId = await createTempPipelineRun();

  // 3. Process each article
  for (const article of articles) {
    console.log(`\n[ReAnalysis] Processing article #${article.id}: ${article.title.substring(0, 50)}...`);

    try {
      // Create temporary staging article for analysis
      const stagingArticleId = await createTempStagingArticle(tempRunId, article);

      // Process each analysis type
      for (const analysisType of analysisTypes) {
        if (analysisType === 'twitter') {
          await reanalyzeTwitter(article.id, stagingArticleId, tempRunId, result);
        } else if (analysisType === 'reddit') {
          console.log(`  ⚠️ Reddit analysis not yet implemented - skipping`);
          // TODO: Implement Reddit re-analysis when reddit analysis module exists
        } else if (analysisType === 'ai_sentiment') {
          console.log(`  ⚠️ AI sentiment analysis not yet implemented - skipping`);
          // TODO: Implement AI sentiment re-analysis when AI analysis module exists
        }
      }

      // Clean up temporary staging article
      await deleteTempStagingArticle(stagingArticleId);

      result.articlesProcessed++;
      console.log(`  ✅ Article #${article.id} re-analyzed successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Failed to re-analyze article #${article.id}:`, errorMessage);
      result.errors.push({
        articleId: article.id,
        error: errorMessage
      });
      // Continue to next article (partial success is OK)
    }
  }

  // 4. Clean up temporary pipeline run
  await deleteTempPipelineRun(tempRunId);

  console.log('\n[ReAnalysis] ✅ Re-analysis complete');
  console.log(`  Articles processed: ${result.articlesProcessed}/${articles.length}`);
  console.log(`  Viewpoints updated: ${result.viewpointsUpdated}`);
  console.log(`  Social posts updated: ${result.socialPostsUpdated}`);
  console.log(`  Errors: ${result.errors.length}`);

  return result;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a temporary pipeline run for re-analysis context
 * (Needed because staging_articles has foreign key to pipeline_runs)
 */
async function createTempPipelineRun(): Promise<number> {
  const result = await turso.execute({
    sql: `INSERT INTO pipeline_runs 
          (run_type, trigger_source, trigger_context, started_at, status, current_stage, config)
          VALUES ('category_refresh', 'manual', '{"reanalysis": true}', datetime('now'), 'complete', 'reanalysis', '{}')`,
    args: []
  });
  return Number(result.lastInsertRowid);
}

/**
 * Delete temporary pipeline run after re-analysis complete
 */
async function deleteTempPipelineRun(runId: number): Promise<void> {
  await turso.execute({
    sql: 'DELETE FROM pipeline_runs WHERE id = ?',
    args: [runId]
  });
}

/**
 * Fetch live articles based on filter
 */
async function fetchLiveArticles(filter: ReanalysisFilter): Promise<LiveArticle[]> {
  let sql = 'SELECT * FROM stories WHERE 1=1';
  const args: any[] = [];

  // Filter by article IDs
  if (filter.articleIds && filter.articleIds.length > 0) {
    const placeholders = filter.articleIds.map(() => '?').join(',');
    sql += ` AND id IN (${placeholders})`;
    args.push(...filter.articleIds);
  }

  // Filter by categories
  if (filter.categories && filter.categories.length > 0) {
    const placeholders = filter.categories.map(() => '?').join(',');
    sql += ` AND category IN (${placeholders})`;
    args.push(...filter.categories);
  }

  // Filter by date range
  if (filter.dateRange) {
    sql += ` AND published_at BETWEEN ? AND ?`;
    args.push(filter.dateRange.from, filter.dateRange.to);
  }

  const result = await turso.execute({ sql, args });
  return result.rows as unknown as LiveArticle[];
}

/**
 * Create temporary staging article for analysis
 * (Needed because analyzeArticleTwitter expects staging context)
 */
async function createTempStagingArticle(
  runId: number,
  article: LiveArticle
): Promise<number> {
  const result = await turso.execute({
    sql: `INSERT INTO staging_articles 
          (run_id, category, title, title_normalized, description, url, url_normalized, 
           content_hash, source, image_url, published_at, fetched_at, pull_batch, status, rejection_reason)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0, 'selected', null)`,
    args: [
      runId,
      article.category,
      article.title,
      article.title.toLowerCase().trim(), // normalized title
      article.description,
      article.url,
      article.url.toLowerCase().trim(), // normalized URL
      '', // content_hash (not needed for re-analysis)
      article.source,
      article.image_url,
      article.published_at
    ]
  });

  return Number(result.lastInsertRowid);
}

/**
 * Delete temporary staging article after analysis
 */
async function deleteTempStagingArticle(stagingArticleId: number): Promise<void> {
  await turso.execute({
    sql: 'DELETE FROM staging_articles WHERE id = ?',
    args: [stagingArticleId]
  });
}

/**
 * Re-analyze article with Twitter analysis
 * Updates live viewpoints and social_posts tables
 */
async function reanalyzeTwitter(
  liveArticleId: number,
  stagingArticleId: number,
  runId: number,
  result: ReanalysisResult
): Promise<void> {
  console.log('  🐦 Running Twitter analysis...');

  // Call existing Twitter analysis function
  const analysis: TwitterAnalysisResult = await analyzeArticleTwitter(runId, stagingArticleId);

  console.log(`  📊 Analysis complete - ${analysis.viewpoints.length} viewpoints, ${analysis.socialPosts.length} social posts`);

  // Update live database with transaction
  await updateLiveDatabaseTwitter(liveArticleId, analysis, result);
}

/**
 * Update live database with Twitter analysis results
 * Uses transaction for atomic delete + insert
 */
async function updateLiveDatabaseTwitter(
  liveArticleId: number,
  analysis: TwitterAnalysisResult,
  result: ReanalysisResult
): Promise<void> {
  console.log('  💾 Updating live database...');

  // Build transaction statements
  // Note: turso.batch() automatically wraps in BEGIN/COMMIT, so we don't add them manually
  const statements: Array<{ sql: string; args: any[] }> = [];

  // Delete old viewpoints for this article
  statements.push({
    sql: 'DELETE FROM viewpoints WHERE story_id = ?',
    args: [liveArticleId]
  });

  // Insert new viewpoints
  for (const vp of analysis.viewpoints) {
    statements.push({
      sql: `INSERT INTO viewpoints (story_id, lean, summary, sentiment_score, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))`,
      args: [liveArticleId, vp.lean, vp.summary, vp.sentiment_score]
    });
  }

  // Delete old social posts for this article (via viewpoints)
  statements.push({
    sql: `DELETE FROM social_posts WHERE viewpoint_id IN 
          (SELECT id FROM viewpoints WHERE story_id = ?)`,
    args: [liveArticleId]
  });

  try {
    // Execute transaction
    await turso.batch(statements);

    // Fetch viewpoint IDs for social posts
    const viewpointResult = await turso.execute({
      sql: 'SELECT id, lean FROM viewpoints WHERE story_id = ? ORDER BY id',
      args: [liveArticleId]
    });
    const viewpointMap = new Map<string, number>();
    for (const row of viewpointResult.rows) {
      viewpointMap.set(row.lean as string, row.id as number);
    }

    // Insert social posts (outside transaction, but after viewpoints exist)
    for (const post of analysis.socialPosts) {
      const viewpointId = viewpointMap.get(post.viewpoint_lean);
      if (!viewpointId) {
        console.warn(`  ⚠️ No viewpoint found for lean: ${post.viewpoint_lean} - skipping post`);
        continue;
      }

      await turso.execute({
        sql: `INSERT INTO social_posts 
              (viewpoint_id, author, author_handle, text, url, platform, likes, retweets, is_real, post_date)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          viewpointId,
          post.author,
          post.author || 'Unknown',  // author_handle fallback
          post.content,                // maps to 'text' column
          post.url,
          'Twitter',                   // platform (hardcoded for now, could come from analysis type)
          post.likes,
          post.retweets,
          post.is_real ? 1 : 0,
          post.timestamp               // maps to 'post_date' column
        ]
      });
    }

    // Update result counters
    result.viewpointsUpdated += analysis.viewpoints.length;
    result.socialPostsUpdated += analysis.socialPosts.length;

    console.log(`  ✅ Live database updated successfully`);

  } catch (error) {
    console.error('  ❌ Transaction failed:', error);
    // turso.batch() automatically rolls back on failure, no manual rollback needed
    throw error;
  }
}
