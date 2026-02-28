/**
 * Twitter Analysis Batch Processor
 * 
 * Processes multiple articles in chunks to stay within Vercel's 60s timeout.
 * Handles writing results to staging tables and updating analysis_jobs status.
 * 
 * Phase: 2.3 - Chunked Processing Support
 * Created: 2026-02-28
 */

import { turso } from '../../db-turso';
import { analyzeArticleTwitter } from './twitter';
import type { TwitterViewpoint, TwitterSocialPost } from './twitter';

// ============================================================================
// TYPES
// ============================================================================

export interface BatchProgress {
  processed: number;
  failed: number;
  remaining: number;
  errors: Array<{ articleId: number; error: string }>;
}

export interface StagingViewpoint {
  id: number;
  run_id: number;
  article_id: number;
  lean: 'left' | 'center' | 'right';
  summary: string;
  sentiment_score: number;
  created_at: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_BATCH_SIZE = 10; // 10 articles × ~5s = 50s (safe for Vercel 60s timeout)
const RATE_LIMIT_DELAY_MS = 2000; // 2 seconds between articles (matches existing logic)

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Write viewpoints to staging_viewpoints table
 */
async function writeStagingViewpoints(
  runId: number,
  articleId: number,
  viewpoints: TwitterViewpoint[]
): Promise<number[]> {
  const viewpointIds: number[] = [];

  for (const vp of viewpoints) {
    const result = await turso.execute({
      sql: `INSERT INTO staging_viewpoints 
            (run_id, article_id, lean, summary, sentiment_score, created_at) 
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING id`,
      args: [
        runId,
        articleId,
        vp.lean,
        vp.summary,
        vp.sentiment_score,
        new Date().toISOString()
      ]
    });

    if (result.rows && result.rows.length > 0) {
      viewpointIds.push(result.rows[0].id as number);
    }
  }

  return viewpointIds;
}

/**
 * Write social posts to staging_social_posts table
 */
async function writeStagingSocialPosts(
  runId: number,
  articleId: number,
  viewpointIds: number[],
  socialPosts: TwitterSocialPost[]
): Promise<void> {
  // Map viewpoint lean to viewpoint ID
  const leanToId: Record<string, number> = {
    left: viewpointIds[0],
    center: viewpointIds[1],
    right: viewpointIds[2]
  };

  for (const post of socialPosts) {
    const viewpointId = leanToId[post.viewpoint_lean];
    if (!viewpointId) {
      console.warn(
        `  ⚠️  Skipping post with unknown lean: ${post.viewpoint_lean}`
      );
      continue;
    }

    await turso.execute({
      sql: `INSERT INTO staging_social_posts 
            (run_id, viewpoint_id, article_id, source, author, content, url, 
             platform_id, likes, retweets, timestamp, is_real, political_leaning_source, 
             created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        runId,
        viewpointId,
        articleId,
        'twitter', // source
        post.author,
        post.content,
        post.url,
        post.platform_id,
        post.likes,
        post.retweets,
        post.timestamp,
        post.is_real ? 1 : 0,
        post.political_leaning_source,
        new Date().toISOString()
      ]
    });
  }
}

/**
 * Update analysis_jobs status
 */
async function updateJobStatus(
  runId: number,
  articleId: number,
  status: 'pending' | 'running' | 'complete' | 'failed' | 'skipped',
  errorMessage?: string
): Promise<void> {
  const now = new Date().toISOString();

  await turso.execute({
    sql: `UPDATE analysis_jobs 
          SET status = ?, 
              ${status === 'running' ? 'started_at = ?,' : ''} 
              ${status === 'complete' || status === 'failed' ? 'completed_at = ?,' : ''} 
              ${errorMessage ? 'error_message = ?,' : ''} 
              attempt_count = attempt_count + 1 
          WHERE run_id = ? AND article_id = ? AND job_type = 'twitter'`,
    args: [
      status,
      ...(status === 'running' ? [now] : []),
      ...(status === 'complete' || status === 'failed' ? [now] : []),
      ...(errorMessage ? [errorMessage] : []),
      runId,
      articleId
    ]
  });
}

/**
 * Create fallback viewpoints when analysis fails
 */
async function createFallbackViewpoints(
  runId: number,
  articleId: number,
  reason: string
): Promise<void> {
  const note = reason.includes('timed out')
    ? 'Analysis timed out — no relevant posts found at this time.'
    : 'Analysis unavailable — no relevant posts found at this time.';

  const leans: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];

  for (const lean of leans) {
    await turso.execute({
      sql: `INSERT INTO staging_viewpoints 
            (run_id, article_id, lean, summary, sentiment_score, created_at) 
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [runId, articleId, lean, note, 0, new Date().toISOString()]
    });
  }

  console.log(`  ⚠️  Created fallback viewpoints with note: ${note}`);
}

// ============================================================================
// MAIN BATCH FUNCTION
// ============================================================================

/**
 * Analyze multiple articles with Twitter data in batches (Vercel 60s timeout safe)
 * 
 * Processes up to `batchSize` articles sequentially. For each article:
 * 1. Calls analyzeArticleTwitter()
 * 2. Writes results to staging_viewpoints + staging_social_posts
 * 3. Updates analysis_jobs table (status: pending → running → complete/failed)
 * 4. Handles errors gracefully (mark job as failed, continue to next)
 * 5. 2-second delay between articles (rate limiting)
 * 
 * Batch size default: 10 articles × ~5s = 50s (safe for Vercel 60s timeout)
 * 
 * @param runId - Pipeline run ID
 * @param articleIds - Array of article IDs to analyze
 * @param batchSize - Articles to process per batch (default: 10)
 * @returns Batch results with progress tracking
 * 
 * @example
 * ```typescript
 * // Process first batch of 10 articles
 * const result = await analyzeArticlesBatch(123, [1, 2, 3, ..., 15], 10);
 * console.log(`Processed: ${result.processed}, Remaining: ${result.remaining}`);
 * 
 * // If remaining > 0, call again with next batch
 * if (result.remaining > 0) {
 *   const nextBatch = articleIds.slice(result.processed);
 *   await analyzeArticlesBatch(123, nextBatch, 10);
 * }
 * ```
 */
export async function analyzeArticlesBatch(
  runId: number,
  articleIds: number[],
  batchSize: number = DEFAULT_BATCH_SIZE
): Promise<BatchProgress> {
  const totalArticles = articleIds.length;
  const articlesToProcess = articleIds.slice(0, batchSize);
  const remainingCount = Math.max(0, totalArticles - batchSize);

  console.log(
    `\n📦 Batch processing ${articlesToProcess.length} articles (${remainingCount} remaining)...`
  );

  let processed = 0;
  let failed = 0;
  const errors: Array<{ articleId: number; error: string }> = [];

  for (let i = 0; i < articlesToProcess.length; i++) {
    const articleId = articlesToProcess[i];

    try {
      console.log(
        `\n  [${i + 1}/${articlesToProcess.length}] Processing article #${articleId}...`
      );

      // Mark job as running
      await updateJobStatus(runId, articleId, 'running');

      // Call core analysis function
      const result = await analyzeArticleTwitter(runId, articleId);

      // Write viewpoints to staging table
      const viewpointIds = await writeStagingViewpoints(
        runId,
        articleId,
        result.viewpoints
      );

      console.log(
        `  ✅ Created ${viewpointIds.length} viewpoints (IDs: ${viewpointIds.join(', ')})`
      );

      // Write social posts to staging table
      if (result.socialPosts.length > 0) {
        await writeStagingSocialPosts(
          runId,
          articleId,
          viewpointIds,
          result.socialPosts
        );
        console.log(`  ✅ Created ${result.socialPosts.length} social posts`);
      } else {
        console.log(`  ℹ️  No social posts found (fallback case)`);
      }

      // Mark job as complete
      await updateJobStatus(runId, articleId, 'complete');

      processed++;
      console.log(`  ✅ Article #${articleId} complete`);
    } catch (error) {
      failed++;
      const errorMsg =
        error instanceof Error ? error.message : String(error);

      console.error(
        `  ❌ Article #${articleId} failed: ${errorMsg}`
      );

      errors.push({ articleId, error: errorMsg });

      // Create fallback viewpoints (empty posts with note)
      try {
        await createFallbackViewpoints(runId, articleId, errorMsg);
      } catch (fallbackError) {
        console.error(
          `  ❌ Failed to create fallback viewpoints: ${fallbackError}`
        );
      }

      // Mark job as failed
      await updateJobStatus(runId, articleId, 'failed', errorMsg);
    }

    // Rate limiting: 2 seconds between articles (except after last article)
    if (i < articlesToProcess.length - 1) {
      console.log(`  ⏳ Rate limiting (${RATE_LIMIT_DELAY_MS / 1000}s)...`);
      await new Promise((resolve) =>
        setTimeout(resolve, RATE_LIMIT_DELAY_MS)
      );
    }
  }

  console.log(
    `\n✅ Batch complete: ${processed} processed, ${failed} failed, ${remainingCount} remaining`
  );

  return {
    processed,
    failed,
    remaining: remainingCount,
    errors
  };
}

/**
 * Analyze ALL articles for a pipeline run (handles batching automatically)
 * 
 * This is a convenience wrapper that processes all pending Twitter analysis jobs
 * in batches until complete. Use this for cron/scheduled runs where timeout is
 * not a concern (can take multiple calls).
 * 
 * @param runId - Pipeline run ID
 * @param batchSize - Articles to process per batch (default: 10)
 * @returns Total progress across all batches
 * 
 * @example
 * ```typescript
 * // Process all pending Twitter jobs for run #123
 * const result = await analyzeAllArticlesTwitter(123);
 * console.log(`Total processed: ${result.processed}, failed: ${result.failed}`);
 * ```
 */
export async function analyzeAllArticlesTwitter(
  runId: number,
  batchSize: number = DEFAULT_BATCH_SIZE
): Promise<BatchProgress> {
  // Get all pending Twitter analysis jobs for this run
  const result = await turso.execute({
    sql: `SELECT article_id FROM analysis_jobs 
          WHERE run_id = ? AND job_type = 'twitter' AND status = 'pending'
          ORDER BY article_id ASC`,
    args: [runId]
  });

  if (!result.rows || result.rows.length === 0) {
    console.log(`\n📭 No pending Twitter analysis jobs for run #${runId}`);
    return { processed: 0, failed: 0, remaining: 0, errors: [] };
  }

  const articleIds = result.rows.map((row) => row.article_id as number);
  console.log(
    `\n🚀 Starting Twitter analysis for ${articleIds.length} articles (run #${runId})...`
  );

  let totalProcessed = 0;
  let totalFailed = 0;
  const allErrors: Array<{ articleId: number; error: string }> = [];

  let remaining = articleIds;
  while (remaining.length > 0) {
    const batchResult = await analyzeArticlesBatch(runId, remaining, batchSize);

    totalProcessed += batchResult.processed;
    totalFailed += batchResult.failed;
    allErrors.push(...batchResult.errors);

    // Move to next batch
    remaining = remaining.slice(batchSize);
  }

  console.log(
    `\n🎉 All batches complete: ${totalProcessed} processed, ${totalFailed} failed`
  );

  return {
    processed: totalProcessed,
    failed: totalFailed,
    remaining: 0,
    errors: allErrors
  };
}
