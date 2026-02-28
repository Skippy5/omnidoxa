import { turso } from '../db-turso';
import {
  createRun as dbCreateRun,
  updateRunStatus as dbUpdateRunStatus,
  getRun,
  getCategoryStatus,
  getStagingArticles,
  getAnalysisJobs,
  type RunType,
  type TriggerSource,
  type RunConfig,
  type PipelineRun
} from '../db-staging';

/**
 * Run Manager Module
 * Handles pipeline run lifecycle, locking, and status management
 * 
 * LOCKING STRATEGY:
 * - Uses singleton table `pipeline_lock` to prevent concurrent NEW data runs
 * - Re-analysis operations do NOT require locks (direct live updates)
 * - Lock is acquired on run creation, released on completion/failure/cancellation
 */

// ============================================================================
// TYPES
// ============================================================================

export interface RunStatusDetailed {
  run: PipelineRun;
  progress: {
    stage: string;
    percent: number;
    message: string;
  };
  stats: {
    categoriesTotal: number;
    categoriesComplete: number;
    articlesProcessed: number;
    articlesTotal: number;
    articlesSelected: number;
    analysisJobsComplete: number;
    analysisJobsTotal: number;
    analysisJobsFailed: number;
  };
  categories?: Array<{
    category: string;
    status: string;
    current_count: number;
    target_count: number;
  }>;
  errors: string[];
}

// ============================================================================
// RUN CREATION WITH LOCKING
// ============================================================================

/**
 * Create a new pipeline run with automatic lock acquisition
 * 
 * @param runType - Type of run (full_refresh, category_refresh, keyword_search)
 * @param triggerSource - What triggered this run
 * @param config - Run configuration
 * @param triggerContext - Optional context
 * @returns Created run ID
 * @throws Error if lock cannot be acquired (another run is in progress)
 * 
 * @example
 * try {
 *   const runId = await createRun('category_refresh', 'conversational', {
 *     categories: ['technology'],
 *     targetCount: 5
 *   });
 *   console.log(`Run ${runId} started`);
 * } catch (error) {
 *   console.error('Another run is in progress');
 * }
 */
export async function createRun(
  runType: RunType,
  triggerSource: TriggerSource,
  config: RunConfig,
  triggerContext?: Record<string, any>
): Promise<number> {
  // Create the run record first
  const runId = await dbCreateRun(runType, triggerSource, config, triggerContext);

  // Try to acquire lock
  const lockAcquired = await acquireLock(runId);
  
  if (!lockAcquired) {
    // Lock failed - mark run as cancelled and throw error
    await dbUpdateRunStatus(runId, 'cancelled', undefined, 'Another run is already in progress');
    throw new Error('Cannot start run: another pipeline run is already in progress');
  }

  return runId;
}

// ============================================================================
// LOCKING MECHANISM
// ============================================================================

/**
 * Acquire pipeline lock (singleton pattern)
 * Only one lock can exist at a time
 * 
 * @param runId - Run ID attempting to acquire the lock
 * @returns true if lock acquired, false if already locked
 * 
 * @example
 * const acquired = await acquireLock(runId);
 * if (!acquired) {
 *   console.error('Lock is held by another run');
 * }
 */
export async function acquireLock(runId: number): Promise<boolean> {
  try {
    // Try to insert lock (will fail if lock already exists)
    await turso.execute({
      sql: `INSERT INTO pipeline_lock (lock_key, run_id, locked_at)
            VALUES ('singleton', ?, datetime('now'))`,
      args: [runId]
    });
    
    return true;
  } catch (error) {
    // Lock already exists - check if it's stale (held >10 minutes)
    const staleThreshold = 10 * 60 * 1000; // 10 minutes in milliseconds
    
    const result = await turso.execute({
      sql: `SELECT run_id, locked_at FROM pipeline_lock WHERE lock_key = 'singleton'`
    });
    
    if (result.rows.length > 0) {
      const lock = result.rows[0] as unknown as { run_id: number; locked_at: string };
      const lockedAt = new Date(lock.locked_at).getTime();
      const now = Date.now();
      
      // If lock is stale, force release and re-acquire
      if (now - lockedAt > staleThreshold) {
        console.warn(`Releasing stale lock held by run ${lock.run_id} for >10 minutes`);
        await releaseLock(lock.run_id);
        return acquireLock(runId); // Retry
      }
    }
    
    return false;
  }
}

/**
 * Release pipeline lock
 * Should be called on run completion, failure, or cancellation
 * 
 * @param runId - Run ID that holds the lock
 * 
 * @example
 * await releaseLock(runId);
 */
export async function releaseLock(runId: number): Promise<void> {
  await turso.execute({
    sql: `DELETE FROM pipeline_lock WHERE lock_key = 'singleton' AND run_id = ?`,
    args: [runId]
  });
}

/**
 * Check if a lock is currently held
 * 
 * @returns Lock info { runId, lockedAt } or null if no lock
 * 
 * @example
 * const lock = await getLockStatus();
 * if (lock) {
 *   console.log(`Run ${lock.runId} is holding the lock since ${lock.lockedAt}`);
 * }
 */
export async function getLockStatus(): Promise<{ runId: number; lockedAt: string } | null> {
  const result = await turso.execute({
    sql: `SELECT run_id, locked_at FROM pipeline_lock WHERE lock_key = 'singleton'`
  });
  
  if (result.rows.length === 0) return null;
  
  const lock = result.rows[0] as unknown as { run_id: number; locked_at: string };
  return { runId: lock.run_id, lockedAt: lock.locked_at };
}

// ============================================================================
// RUN STATUS MANAGEMENT
// ============================================================================

/**
 * Get detailed run status with progress and statistics
 * 
 * @param runId - Run ID to check
 * @returns Detailed status object or null if run not found
 * 
 * @example
 * const status = await getRunStatus(runId);
 * console.log(`Progress: ${status.progress.percent}%`);
 * console.log(`Stage: ${status.progress.stage}`);
 */
export async function getRunStatus(runId: number): Promise<RunStatusDetailed | null> {
  const run = await getRun(runId);
  if (!run) return null;

  // Parse config
  const config = JSON.parse(run.config) as RunConfig;
  
  // Get category status (if applicable)
  const categoryStatuses = await getCategoryStatus(runId);
  
  // Get staging articles
  const allArticles = await getStagingArticles(runId);
  const selectedArticles = await getStagingArticles(runId, { status: 'selected' });
  
  // Get analysis jobs
  const allJobs = await getAnalysisJobs(runId);
  const completeJobs = allJobs.filter(j => j.status === 'complete');
  const failedJobs = allJobs.filter(j => j.status === 'failed');
  
  // Calculate progress percentage
  let percent = 0;
  let stage = run.current_stage || 'Initializing';
  let message = 'Starting pipeline...';
  
  if (run.status === 'running') {
    if (categoryStatuses.length > 0) {
      const completedCategories = categoryStatuses.filter(c => c.status === 'complete').length;
      percent = Math.round((completedCategories / categoryStatuses.length) * 30); // Ingestion = 30%
      stage = 'Ingesting articles';
      message = `Fetching articles: ${completedCategories}/${categoryStatuses.length} categories complete`;
    } else {
      percent = 15;
      message = 'Fetching articles...';
    }
  } else if (run.status === 'analyzing') {
    const analysisPercent = allJobs.length > 0 
      ? (completeJobs.length / allJobs.length) * 100
      : 0;
    percent = 30 + Math.round(analysisPercent * 0.5); // 30-80%
    stage = 'Running analysis';
    message = `Analysis: ${completeJobs.length}/${allJobs.length} jobs complete`;
  } else if (run.status === 'promoting') {
    percent = 85;
    stage = 'Promoting to live';
    message = 'Writing to live database...';
  } else if (run.status === 'complete') {
    percent = 100;
    stage = 'Complete';
    message = 'Pipeline completed successfully';
  } else if (run.status === 'failed') {
    percent = 0;
    stage = 'Failed';
    message = run.error_message || 'Pipeline failed';
  } else if (run.status === 'cancelled') {
    percent = 0;
    stage = 'Cancelled';
    message = 'Pipeline was cancelled';
  }
  
  // Collect errors
  const errors: string[] = [];
  if (run.error_message) {
    errors.push(run.error_message);
  }
  
  failedJobs.forEach(job => {
    if (job.error_message) {
      errors.push(`Job ${job.id} (${job.job_type}): ${job.error_message}`);
    }
  });
  
  return {
    run,
    progress: {
      stage,
      percent,
      message
    },
    stats: {
      categoriesTotal: categoryStatuses.length,
      categoriesComplete: categoryStatuses.filter(c => c.status === 'complete').length,
      articlesProcessed: allArticles.length,
      articlesTotal: allArticles.length,
      articlesSelected: selectedArticles.length,
      analysisJobsComplete: completeJobs.length,
      analysisJobsTotal: allJobs.length,
      analysisJobsFailed: failedJobs.length
    },
    categories: categoryStatuses.map(c => ({
      category: c.category,
      status: c.status,
      current_count: c.current_count,
      target_count: c.target_count
    })),
    errors
  };
}

/**
 * Mark run as complete and release lock
 * 
 * @param runId - Run ID to complete
 * 
 * @example
 * await completeRun(runId);
 */
export async function completeRun(runId: number): Promise<void> {
  await dbUpdateRunStatus(runId, 'complete');
  await releaseLock(runId);
}

/**
 * Mark run as failed, store error, and release lock
 * 
 * @param runId - Run ID to mark as failed
 * @param error - Error message or Error object
 * 
 * @example
 * try {
 *   // ... pipeline work
 * } catch (error) {
 *   await failRun(runId, error);
 * }
 */
export async function failRun(runId: number, error: string | Error): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : error;
  await dbUpdateRunStatus(runId, 'failed', undefined, errorMessage);
  await releaseLock(runId);
}

/**
 * Cancel a running pipeline and release lock
 * 
 * @param runId - Run ID to cancel
 * 
 * @example
 * await cancelRun(runId);
 */
export async function cancelRun(runId: number): Promise<void> {
  await dbUpdateRunStatus(runId, 'cancelled', undefined, 'Cancelled by user');
  await releaseLock(runId);
}

/**
 * Update run status (wrapper around db function)
 * Does NOT release lock - use completeRun/failRun/cancelRun for that
 * 
 * @param runId - Run ID
 * @param status - New status
 * @param stage - Optional stage description
 * 
 * @example
 * await updateRunStatus(runId, 'analyzing', 'Running Twitter analysis');
 */
export async function updateRunStatus(
  runId: number,
  status: 'running' | 'analyzing' | 'promoting',
  stage?: string
): Promise<void> {
  await dbUpdateRunStatus(runId, status, stage);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if any run is currently in progress
 * 
 * @returns true if a run is active, false otherwise
 * 
 * @example
 * if (await isRunInProgress()) {
 *   console.log('A pipeline run is already active');
 * }
 */
export async function isRunInProgress(): Promise<boolean> {
  const lock = await getLockStatus();
  return lock !== null;
}

/**
 * Get the currently active run (if any)
 * 
 * @returns Active run details or null
 * 
 * @example
 * const activeRun = await getActiveRun();
 * if (activeRun) {
 *   console.log(`Run ${activeRun.id} is ${activeRun.status}`);
 * }
 */
export async function getActiveRun(): Promise<PipelineRun | null> {
  const lock = await getLockStatus();
  if (!lock) return null;
  
  return getRun(lock.runId);
}

/**
 * Force release a stale lock (admin/debug function)
 * WARNING: Use with caution - only call if you're sure the run is dead
 * 
 * @param runId - Optional run ID (if omitted, releases any lock)
 * 
 * @example
 * await forceReleaseLock(); // Release any lock
 * await forceReleaseLock(123); // Release lock held by run 123
 */
export async function forceReleaseLock(runId?: number): Promise<void> {
  if (runId !== undefined) {
    await releaseLock(runId);
  } else {
    // Release any lock
    await turso.execute({
      sql: `DELETE FROM pipeline_lock WHERE lock_key = 'singleton'`
    });
  }
}

/**
 * Estimate duration for a pipeline operation
 * Returns estimated time in seconds based on operation type and config
 * 
 * @param operation - Type of pipeline operation
 * @param config - Operation configuration (categories, articles, etc.)
 * @returns Estimated duration in seconds
 */
export function estimateDuration(operation: RunType, config: RunConfig): number {
  // Base estimates in seconds
  const estimates: Record<RunType, number> = {
    'full_refresh': 300,      // 5 minutes for all categories
    'category_refresh': 60,   // 1 minute per category  
    'keyword_search': 120,    // 2 minutes for keyword search
    'reanalyze_category': 30  // 30 seconds for re-analysis
  };
  
  let baseDuration = estimates[operation] || 60;
  
  // Adjust based on config
  if (operation === 'category_refresh' && config.categories) {
    baseDuration = config.categories.length * 60;
  }
  
  if (config.maxArticles && config.maxArticles > 10) {
    baseDuration += Math.floor(config.maxArticles / 10) * 20;
  }
  
  return baseDuration;
}
