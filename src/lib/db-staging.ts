import { turso } from './db-turso';
import type { Category } from './types';

/**
 * Database helper module for staging tables
 * Provides CRUD operations for pipeline_runs, staging_articles, analysis_jobs, etc.
 */

// ============================================================================
// TYPES
// ============================================================================

export type RunType = 'full_refresh' | 'category_refresh' | 'keyword_search' | 'reanalyze_category';
export type TriggerSource = 'cron' | 'manual' | 'conversational';
export type RunStatus = 'running' | 'analyzing' | 'promoting' | 'complete' | 'failed' | 'cancelled';
export type CategoryStage = 'pending' | 'fetching' | 'ready' | 'complete' | 'failed';
export type ArticleStatus = 'staged' | 'selected' | 'rejected';
export type JobType = 'twitter' | 'reddit' | 'ai_sentiment';
export type JobStatus = 'pending' | 'running' | 'complete' | 'failed' | 'skipped';

export interface RunConfig {
  categories?: string[];
  category?: string;
  keywords?: string;
  targetCount?: number;
  maxArticles?: number;
  analysisTypes?: JobType[];
  articleIds?: number[];
  dateRange?: { from: string; to: string; };
  [key: string]: any; // Allow additional config
}

export interface PipelineRun {
  id: number;
  run_type: RunType;
  trigger_source: TriggerSource;
  trigger_context: string | null; // JSON string
  started_at: string;
  completed_at: string | null;
  status: RunStatus;
  current_stage: string | null;
  error_message: string | null;
  config: string; // JSON string
}

export interface CategoryStatus {
  id: number;
  run_id: number;
  category: string;
  target_count: number;
  current_count: number;
  pull_attempts: number;
  status: CategoryStage;
  updated_at: string;
}

export interface StagingArticle {
  id: number;
  run_id: number;
  category: string;
  title: string;
  title_normalized: string;
  description: string | null;
  url: string;
  url_normalized: string;
  content_hash: string;
  source: string;
  image_url: string | null;
  published_at: string | null;
  fetched_at: string;
  pull_batch: number;
  status: ArticleStatus;
  rejection_reason: string | null;
  created_at: string;
}

export interface AnalysisJob {
  id: number;
  run_id: number;
  article_id: number;
  job_type: JobType;
  status: JobStatus;
  attempt_count: number;
  max_attempts: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

// ============================================================================
// PIPELINE RUNS
// ============================================================================

/**
 * Create a new pipeline run
 * 
 * @param runType - Type of run (full_refresh, category_refresh, keyword_search)
 * @param triggerSource - What triggered this run (cron, manual, conversational)
 * @param config - Run configuration (categories, keywords, etc.)
 * @param triggerContext - Optional context (user request, function call, etc.)
 * @returns Created run ID
 * 
 * @example
 * const runId = await createRun('category_refresh', 'conversational', {
 *   categories: ['technology'],
 *   targetCount: 5
 * }, { user_request: 'Pull fresh tech articles' });
 */
export async function createRun(
  runType: RunType,
  triggerSource: TriggerSource,
  config: RunConfig,
  triggerContext?: Record<string, any>
): Promise<number> {
  const result = await turso.execute({
    sql: `INSERT INTO pipeline_runs (run_type, trigger_source, trigger_context, started_at, status, config)
          VALUES (?, ?, ?, datetime('now'), 'running', ?)`,
    args: [
      runType,
      triggerSource,
      triggerContext ? JSON.stringify(triggerContext) : null,
      JSON.stringify(config)
    ]
  });

  return Number(result.lastInsertRowid);
}

/**
 * Update run status
 * 
 * @param runId - Run ID to update
 * @param status - New status
 * @param stage - Optional current stage description
 * @param error - Optional error message (for failed status)
 * 
 * @example
 * await updateRunStatus(runId, 'analyzing', 'Running Twitter analysis');
 * await updateRunStatus(runId, 'failed', null, 'API timeout');
 */
export async function updateRunStatus(
  runId: number,
  status: RunStatus,
  stage?: string,
  error?: string
): Promise<void> {
  const updates: string[] = ['status = ?'];
  const args: any[] = [status];

  if (stage !== undefined) {
    updates.push('current_stage = ?');
    args.push(stage);
  }

  if (error !== undefined) {
    updates.push('error_message = ?');
    args.push(error);
  }

  if (status === 'complete' || status === 'failed' || status === 'cancelled') {
    updates.push("completed_at = datetime('now')");
  }

  args.push(runId);

  await turso.execute({
    sql: `UPDATE pipeline_runs SET ${updates.join(', ')} WHERE id = ?`,
    args
  });
}

/**
 * Get run details
 * 
 * @param runId - Run ID to fetch
 * @returns Run details or null if not found
 * 
 * @example
 * const run = await getRun(123);
 * if (run) {
 *   console.log(`Run ${run.id} is ${run.status}`);
 * }
 */
export async function getRun(runId: number): Promise<PipelineRun | null> {
  const result = await turso.execute({
    sql: 'SELECT * FROM pipeline_runs WHERE id = ?',
    args: [runId]
  });

  if (result.rows.length === 0) return null;

  return result.rows[0] as unknown as PipelineRun;
}

// ============================================================================
// CATEGORY STATUS
// ============================================================================

/**
 * Initialize category status for a run
 * Creates entries for each category with target counts
 * 
 * @param runId - Run ID
 * @param categories - Array of category names with optional target counts
 * 
 * @example
 * await initCategoryStatus(runId, [
 *   { category: 'technology', targetCount: 5 },
 *   { category: 'politics', targetCount: 10 }
 * ]);
 */
export async function initCategoryStatus(
  runId: number,
  categories: string[],
  targetCount: number = 5
): Promise<void> {
  // Insert each category sequentially to avoid batch type issues
  for (const category of categories) {
    await turso.execute({
      sql: `INSERT INTO category_status (run_id, category, target_count, current_count, pull_attempts, status)
            VALUES (?, ?, ?, 0, 0, 'pending')`,
      args: [runId, category, targetCount]
    });
  }
}

/**
 * Update category status
 * 
 * @param runId - Run ID
 * @param category - Category name
 * @param updates - Fields to update
 * 
 * @example
 * await updateCategoryStatus(runId, 'technology', {
 *   current_count: 50,
 *   status: 'ready'
 * });
 */
export async function updateCategoryStatus(
  runId: number,
  category: string,
  updates: {
    current_count?: number;
    pull_attempts?: number;
    status?: CategoryStage;
  }
): Promise<void> {
  const fields: string[] = ["updated_at = datetime('now')"];
  const args: any[] = [];

  if (updates.current_count !== undefined) {
    fields.push('current_count = ?');
    args.push(updates.current_count);
  }

  if (updates.pull_attempts !== undefined) {
    fields.push('pull_attempts = ?');
    args.push(updates.pull_attempts);
  }

  if (updates.status !== undefined) {
    fields.push('status = ?');
    args.push(updates.status);
  }

  args.push(runId, category);

  await turso.execute({
    sql: `UPDATE category_status SET ${fields.join(', ')} WHERE run_id = ? AND category = ?`,
    args
  });
}

/**
 * Get category status for a run
 * 
 * @param runId - Run ID
 * @param category - Optional category filter
 * @returns Array of category status records
 * 
 * @example
 * const statuses = await getCategoryStatus(runId);
 * const techStatus = await getCategoryStatus(runId, 'technology');
 */
export async function getCategoryStatus(
  runId: number,
  category?: string
): Promise<CategoryStatus[]> {
  let sql = 'SELECT * FROM category_status WHERE run_id = ?';
  const args: any[] = [runId];

  if (category) {
    sql += ' AND category = ?';
    args.push(category);
  }

  const result = await turso.execute({ sql, args });
  return result.rows as unknown as CategoryStatus[];
}

// ============================================================================
// STAGING ARTICLES
// ============================================================================

/**
 * Insert a single staging article
 * 
 * @param article - Article data (without id and created_at)
 * @returns Inserted article ID
 * 
 * @example
 * const articleId = await insertStagingArticle({
 *   run_id: 123,
 *   category: 'technology',
 *   title: 'Breaking News',
 *   title_normalized: 'breaking news',
 *   url: 'https://example.com/article',
 *   url_normalized: 'https://example.com/article',
 *   content_hash: 'abc123...',
 *   source: 'TechCrunch',
 *   fetched_at: new Date().toISOString(),
 *   pull_batch: 1
 * });
 */
export async function insertStagingArticle(
  article: Omit<StagingArticle, 'id' | 'created_at' | 'fetched_at'>
): Promise<number> {
  const result = await turso.execute({
    sql: `INSERT INTO staging_articles 
          (run_id, category, title, title_normalized, description, url, url_normalized, 
           content_hash, source, image_url, published_at, pull_batch, status, rejection_reason)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      article.run_id,
      article.category,
      article.title,
      article.title_normalized,
      article.description ?? null,
      article.url,
      article.url_normalized,
      article.content_hash,
      article.source ?? null,
      article.image_url ?? null,
      article.published_at ?? null,
      article.pull_batch,
      article.status,
      article.rejection_reason ?? null
    ]
  });

  return Number(result.lastInsertRowid);
}

/**
 * Bulk insert staging articles
 * More efficient than calling insertStagingArticle() in a loop
 * 
 * @param articles - Array of articles to insert
 * @returns Array of inserted article IDs
 * 
 * @example
 * const ids = await bulkInsertStagingArticles(articles);
 */
export async function bulkInsertStagingArticles(
  articles: Omit<StagingArticle, 'id' | 'created_at' | 'fetched_at'>[]
): Promise<void> {
  if (articles.length === 0) return;
  
  // Turso batch execution - insert sequentially to avoid type issues
  for (const article of articles) {
    await turso.execute({
      sql: `INSERT INTO staging_articles 
            (run_id, category, title, title_normalized, description, url, url_normalized, 
             content_hash, source, image_url, published_at, pull_batch, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        article.run_id,
        article.category,
        article.title,
        article.title_normalized,
        article.description ?? null,
        article.url,
        article.url_normalized,
        article.content_hash,
        article.source ?? null,
        article.image_url ?? null,
        article.published_at ?? null,
        article.pull_batch,
        article.status
      ]
    });
  }
}

/**
 * Get staging articles with optional filters
 * 
 * @param runId - Run ID to filter by
 * @param filters - Optional filters (category, status, pull_batch)
 * @returns Array of staging articles
 * 
 * @example
 * const allArticles = await getStagingArticles(runId);
 * const selectedTech = await getStagingArticles(runId, { category: 'technology', status: 'selected' });
 */
export async function getStagingArticles(
  runId: number,
  filters?: {
    category?: string;
    status?: ArticleStatus;
    pull_batch?: number;
  }
): Promise<StagingArticle[]> {
  let sql = 'SELECT * FROM staging_articles WHERE run_id = ?';
  const args: any[] = [runId];

  if (filters?.category) {
    sql += ' AND category = ?';
    args.push(filters.category);
  }

  if (filters?.status) {
    sql += ' AND status = ?';
    args.push(filters.status);
  }

  if (filters?.pull_batch !== undefined) {
    sql += ' AND pull_batch = ?';
    args.push(filters.pull_batch);
  }

  sql += ' ORDER BY published_at DESC';

  const result = await turso.execute({ sql, args });
  return result.rows as unknown as StagingArticle[];
}

/**
 * Update article status (selected/rejected)
 * 
 * @param articleId - Article ID to update
 * @param status - New status
 * @param reason - Optional rejection reason
 * 
 * @example
 * await updateArticleStatus(articleId, 'selected');
 * await updateArticleStatus(articleId, 'rejected', 'duplicate_url');
 */
export async function updateArticleStatus(
  articleId: number,
  status: ArticleStatus,
  reason?: string
): Promise<void> {
  await turso.execute({
    sql: 'UPDATE staging_articles SET status = ?, rejection_reason = ? WHERE id = ?',
    args: [status, reason || null, articleId]
  });
}

/**
 * Bulk update article statuses (more efficient for batch operations)
 * 
 * @param updates - Array of { id, status, reason? }
 * 
 * @example
 * await bulkUpdateArticleStatus([
 *   { id: 1, status: 'selected' },
 *   { id: 2, status: 'rejected', reason: 'duplicate' },
 * ]);
 */
export async function bulkUpdateArticleStatus(
  updates: Array<{ id: number; status: ArticleStatus; reason?: string }>
): Promise<void> {
  if (updates.length === 0) return;

  const queries = updates.map(({ id, status, reason }) => ({
    sql: 'UPDATE staging_articles SET status = ?, rejection_reason = ? WHERE id = ?',
    args: [status, reason || null, id]
  }));

  await turso.batch(queries);
}

// ============================================================================
// ANALYSIS JOBS
// ============================================================================

/**
 * Create an analysis job
 * 
 * @param runId - Run ID
 * @param articleId - Article ID to analyze
 * @param jobType - Type of analysis (twitter, reddit, ai_sentiment)
 * @returns Created job ID
 * 
 * @example
 * const jobId = await createAnalysisJob(runId, articleId, 'twitter');
 */
export async function createAnalysisJob(
  runId: number,
  articleId: number,
  jobType: JobType
): Promise<number> {
  const result = await turso.execute({
    sql: `INSERT INTO analysis_jobs (run_id, article_id, job_type, status)
          VALUES (?, ?, ?, 'pending')`,
    args: [runId, articleId, jobType]
  });

  return Number(result.lastInsertRowid);
}

/**
 * Bulk create analysis jobs
 * 
 * @param jobs - Array of { runId, articleId, jobType }
 * @returns Array of created job IDs
 * 
 * @example
 * const jobIds = await bulkCreateAnalysisJobs([
 *   { runId, articleId: 1, jobType: 'twitter' },
 *   { runId, articleId: 2, jobType: 'twitter' },
 * ]);
 */
export async function bulkCreateAnalysisJobs(
  jobs: Array<{ runId: number; articleId: number; jobType: JobType }>
): Promise<number[]> {
  if (jobs.length === 0) return [];

  const queries = jobs.map(({ runId, articleId, jobType }) => ({
    sql: `INSERT INTO analysis_jobs (run_id, article_id, job_type, status)
          VALUES (?, ?, ?, 'pending')`,
    args: [runId, articleId, jobType]
  }));

  const results = await turso.batch(queries);
  return results.map(r => Number(r.lastInsertRowid));
}

/**
 * Update analysis job status
 * 
 * @param jobId - Job ID to update
 * @param status - New status
 * @param error - Optional error message (for failed status)
 * 
 * @example
 * await updateAnalysisJob(jobId, 'running');
 * await updateAnalysisJob(jobId, 'complete');
 * await updateAnalysisJob(jobId, 'failed', 'API timeout');
 */
export async function updateAnalysisJob(
  jobId: number,
  status: JobStatus,
  error?: string
): Promise<void> {
  const updates: string[] = ['status = ?'];
  const args: any[] = [status];

  if (status === 'running') {
    updates.push("started_at = datetime('now')");
    updates.push('attempt_count = attempt_count + 1');
  }

  if (status === 'complete' || status === 'failed' || status === 'skipped') {
    updates.push("completed_at = datetime('now')");
  }

  if (error !== undefined) {
    updates.push('error_message = ?');
    args.push(error);
  }

  args.push(jobId);

  await turso.execute({
    sql: `UPDATE analysis_jobs SET ${updates.join(', ')} WHERE id = ?`,
    args
  });
}

/**
 * Get analysis jobs with optional filters
 * 
 * @param runId - Run ID to filter by
 * @param filters - Optional filters (jobType, status, articleId)
 * @returns Array of analysis jobs
 * 
 * @example
 * const allJobs = await getAnalysisJobs(runId);
 * const twitterJobs = await getAnalysisJobs(runId, { jobType: 'twitter' });
 * const failedJobs = await getAnalysisJobs(runId, { status: 'failed' });
 */
export async function getAnalysisJobs(
  runId: number,
  filters?: {
    jobType?: JobType;
    status?: JobStatus;
    articleId?: number;
  }
): Promise<AnalysisJob[]> {
  let sql = 'SELECT * FROM analysis_jobs WHERE run_id = ?';
  const args: any[] = [runId];

  if (filters?.jobType) {
    sql += ' AND job_type = ?';
    args.push(filters.jobType);
  }

  if (filters?.status) {
    sql += ' AND status = ?';
    args.push(filters.status);
  }

  if (filters?.articleId !== undefined) {
    sql += ' AND article_id = ?';
    args.push(filters.articleId);
  }

  const result = await turso.execute({ sql, args });
  return result.rows as unknown as AnalysisJob[];
}

/**
 * Get jobs that need retry (failed but under max_attempts)
 * 
 * @param runId - Run ID
 * @returns Array of retryable jobs
 * 
 * @example
 * const retryJobs = await getRetryableJobs(runId);
 * for (const job of retryJobs) {
 *   await retryAnalysis(job.id);
 * }
 */
export async function getRetryableJobs(runId: number): Promise<AnalysisJob[]> {
  const result = await turso.execute({
    sql: `SELECT * FROM analysis_jobs 
          WHERE run_id = ? AND status = 'failed' AND attempt_count < max_attempts`,
    args: [runId]
  });

  return result.rows as unknown as AnalysisJob[];
}
