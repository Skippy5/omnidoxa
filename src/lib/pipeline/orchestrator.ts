/**
 * OmniDoxa Pipeline - Orchestrator Module
 * 
 * Routes pipeline operations and chains execution stages
 * 
 * Operations:
 * - full_refresh: All 10 categories, 5 articles each
 * - refresh_categories: Specific categories
 * - search_news: Ad-hoc keyword search
 * - reanalyze_category: Re-analyze existing live articles (no re-fetch)
 * 
 * Stages:
 * 1. Ingestion (fetch articles)
 * 2. Deduplication (4-layer dedup)
 * 3. Validation (count checks, selection)
 * 4. Analysis (Twitter viewpoints + social posts, Reddit/AI FUTURE)
 * 5. Promotion (UPSERT to live tables)
 * 
 * Phase: 1.12 - Orchestrator Module
 * Updated: 2026-02-28 (Phase 3.2 - Re-analysis capability added)
 * Created: 2026-02-28
 */

import { turso } from '../db-turso';
import type { Category } from '../types';
import { deduplicateRun } from './deduplication';
import { selectTopArticles, validateCounts, getValidationSummary } from './validation';
import { promoteToLive, getPromotionSummary } from './promotion';
import { analyzeArticlesBatch } from './analysis/twitter-batch';
import { getStagingArticles } from '../db-staging';
import { runFullRefresh } from './ingestion/full-refresh';
import { runCategoryRefresh } from './ingestion/category-refresh';
import { runKeywordSearch } from './ingestion/keyword-search';
import { reanalyzeArticles } from './reanalysis';

export type PipelineOperation = 'full_refresh' | 'refresh_categories' | 'search_news' | 'reanalyze_category';
export type TriggerSource = 'cron' | 'manual' | 'conversational';

export interface PipelineParams {
  // For full_refresh
  articlesPerCategory?: number;
  
  // For refresh_categories
  categories?: Category[];
  
  // For search_news
  keywords?: string;
  maxArticles?: number;
  
  // For reanalyze_category
  category?: Category;
  articleIds?: number[];
  dateRange?: { from: string; to: string; };
  analysisTypes?: ('twitter' | 'reddit' | 'ai_sentiment')[];
}

export interface TriggerContext {
  user_request?: string;
  function_call?: string;
  function_params?: Record<string, any>;
}

export interface PipelineResult {
  success: boolean;
  runId?: number;
  operation: PipelineOperation;
  stages: {
    ingestion?: { status: 'complete' | 'failed'; articlesStaged?: number; error?: string };
    deduplication?: { status: 'complete' | 'failed'; duplicatesRemoved?: number; error?: string };
    validation?: { status: 'complete' | 'failed'; articlesSelected?: number; error?: string };
    analysis?: { status: 'complete' | 'failed' | 'skipped'; jobsCompleted?: number; error?: string };
    promotion?: { status: 'complete' | 'failed'; storiesPromoted?: number; error?: string };
  };
  errors: string[];
  duration?: number;
}

/**
 * Update run stage
 */
async function updateRunStage(runId: number, stage: string, status?: string): Promise<void> {
  const updates: string[] = ['current_stage = ?'];
  const args: any[] = [stage];
  
  if (status) {
    updates.push('status = ?');
    args.push(status);
  }
  
  // Note: pipeline_runs table doesn't have updated_at column (uses started_at/completed_at instead)
  
  await turso.execute({
    sql: `UPDATE pipeline_runs SET ${updates.join(', ')} WHERE id = ?`,
    args: [...args, runId]
  });
}

/**
 * Create pipeline run
 */
async function createRun(
  operation: PipelineOperation,
  params: PipelineParams,
  triggerSource: TriggerSource,
  triggerContext?: TriggerContext
): Promise<number> {
  const config = JSON.stringify(params);
  const context = triggerContext ? JSON.stringify(triggerContext) : null;
  
  const result = await turso.execute({
    sql: `INSERT INTO pipeline_runs 
          (run_type, trigger_source, trigger_context, started_at, status, current_stage, config)
          VALUES (?, ?, ?, datetime('now'), 'running', 'initializing', ?)`,
    args: [operation, triggerSource, context, config]
  });
  
  return Number(result.lastInsertRowid);
}

/**
 * Initialize category status for a run
 */
async function initCategoryStatus(runId: number, categories: Category[], targetCount: number = 5): Promise<void> {
  for (const category of categories) {
    await turso.execute({
      sql: `INSERT INTO category_status (run_id, category, target_count, current_count, pull_attempts, status)
            VALUES (?, ?, ?, 0, 0, 'pending')`,
      args: [runId, category, targetCount]
    });
  }
}

/**
 * Stage: Ingestion
 * NOTE: Actual fetching logic requires ingestion modules (not yet implemented)
 */
async function runIngestion(
  runId: number,
  operation: PipelineOperation,
  params: PipelineParams
): Promise<{ status: 'complete' | 'failed'; articlesStaged?: number; error?: string }> {
  console.log(`[Orchestrator] Stage: Ingestion (${operation})`);
  
  try {
    await updateRunStage(runId, 'ingestion', 'running');
    
    let articlesStaged = 0;
    
    // Call appropriate ingestion module
    if (operation === 'full_refresh') {
      articlesStaged = await runFullRefresh(runId);
      console.log(`[Orchestrator] Full refresh staged ${articlesStaged} articles`);
    } else if (operation === 'refresh_categories') {
      if (!params.categories || params.categories.length === 0) {
        return {
          status: 'failed',
          error: 'refresh_categories requires params.categories'
        };
      }
      articlesStaged = await runCategoryRefresh(runId, params.categories);
      console.log(`[Orchestrator] Category refresh staged ${articlesStaged} articles`);
    } else if (operation === 'search_news') {
      if (!params.keywords) {
        return {
          status: 'failed',
          error: 'search_news requires params.keywords'
        };
      }
      articlesStaged = await runKeywordSearch(runId, params.keywords, params.maxArticles || 10);
      console.log(`[Orchestrator] Keyword search staged ${articlesStaged} articles`);
    }
    
    if (articlesStaged === 0) {
      return {
        status: 'failed',
        error: 'No articles were staged during ingestion'
      };
    }
    
    return {
      status: 'complete',
      articlesStaged
    };
    
  } catch (error: any) {
    console.error('[Orchestrator] Ingestion failed:', error);
    await turso.execute({
      sql: 'UPDATE pipeline_runs SET status = ?, error_message = ? WHERE id = ?',
      args: ['failed', error.message, runId]
    });
    return {
      status: 'failed',
      error: error.message
    };
  }
}

/**
 * Stage: Deduplication
 */
async function runDeduplication(
  runId: number
): Promise<{ status: 'complete' | 'failed'; duplicatesRemoved?: number; error?: string }> {
  console.log('[Orchestrator] Stage: Deduplication');
  
  try {
    await updateRunStage(runId, 'deduplication');
    
    const result = await deduplicateRun(runId);
    
    return {
      status: 'complete',
      duplicatesRemoved: result.duplicatesFound
    };
    
  } catch (error: any) {
    console.error('[Orchestrator] Deduplication failed:', error);
    return {
      status: 'failed',
      error: error.message
    };
  }
}

/**
 * Stage: Validation
 */
async function runValidation(
  runId: number,
  params: PipelineParams
): Promise<{ status: 'complete' | 'failed'; articlesSelected?: number; error?: string }> {
  console.log('[Orchestrator] Stage: Validation');
  
  try {
    await updateRunStage(runId, 'validation');
    
    // Get categories to validate
    const categoriesResult = await turso.execute({
      sql: 'SELECT category, target_count FROM category_status WHERE run_id = ?',
      args: [runId]
    });
    
    const categories = categoriesResult.rows as any[];
    let totalSelected = 0;
    
    // Select top articles for each category
    for (const cat of categories) {
      const { selected } = await selectTopArticles(runId, cat.category as Category, cat.target_count as number);
      totalSelected += selected;
    }
    
    // Validate counts
    const { valid, shortCategories } = await validateCounts(runId);
    
    if (!valid) {
      console.warn(`[Orchestrator] ⚠️ ${shortCategories.length} categories below target`);
      // Not a failure - just a warning
    }
    
    return {
      status: 'complete',
      articlesSelected: totalSelected
    };
    
  } catch (error: any) {
    console.error('[Orchestrator] Validation failed:', error);
    return {
      status: 'failed',
      error: error.message
    };
  }
}

/**
 * Stage: Analysis (Twitter, Reddit, AI)
 * 
 * Phase 2.5: Integrated Twitter analysis with chunked processing
 */
async function runAnalysis(
  runId: number
): Promise<{ status: 'complete' | 'failed' | 'skipped'; jobsCompleted?: number; error?: string }> {
  console.log('[Orchestrator] Stage: Analysis');
  
  try {
    await updateRunStage(runId, 'analysis', 'analyzing');
    
    // Get selected articles for analysis
    const articles = await getStagingArticles(runId, { status: 'selected' });
    
    if (articles.length === 0) {
      console.log('[Orchestrator] No articles to analyze, skipping Twitter analysis');
      return {
        status: 'skipped',
        jobsCompleted: 0
      };
    }
    
    console.log(`[Orchestrator] Starting Twitter analysis for ${articles.length} articles`);
    
    // Run Twitter analysis in chunks (Vercel timeout safety)
    const CHUNK_SIZE = 10;
    let offset = 0;
    let totalProcessed = 0;
    let totalFailed = 0;
    const allErrors: Array<{ articleId: number; error: string }> = [];
    
    while (offset < articles.length) {
      const batch = articles.slice(offset, offset + CHUNK_SIZE);
      const articleIds = batch.map(a => a.id);
      
      console.log(`[Orchestrator] Processing chunk ${offset + 1}-${offset + batch.length} of ${articles.length}`);
      
      // Analyze batch
      const batchResult = await analyzeArticlesBatch(runId, articleIds, CHUNK_SIZE);
      
      totalProcessed += batchResult.processed;
      totalFailed += batchResult.failed;
      allErrors.push(...batchResult.errors);
      
      offset += batch.length;
      
      // Update run status with progress
      await turso.execute({
        sql: `UPDATE pipeline_runs 
              SET status = 'running',
                  updated_at = datetime('now')
              WHERE id = ?`,
        args: [runId]
      });
      
      console.log(`[Orchestrator] Twitter analysis progress: ${totalProcessed}/${articles.length} processed, ${totalFailed} failed`);
    }
    
    // Handle failures
    if (totalFailed === articles.length) {
      // All articles failed - this is a failure
      console.error('[Orchestrator] ❌ All articles failed Twitter analysis');
      return {
        status: 'failed',
        error: `All ${articles.length} articles failed analysis`,
        jobsCompleted: 0
      };
    }
    
    if (totalFailed > 0) {
      // Partial success - log errors but continue
      console.warn(`[Orchestrator] ⚠️ ${totalFailed} articles failed Twitter analysis (partial success)`);
      console.warn('[Orchestrator] Errors:', allErrors.slice(0, 5)); // Log first 5 errors
    }
    
    console.log(`[Orchestrator] ✅ Twitter analysis complete: ${totalProcessed} processed, ${totalFailed} failed`);
    
    return {
      status: 'complete',
      jobsCompleted: totalProcessed
    };
    
  } catch (error: any) {
    console.error('[Orchestrator] Analysis failed:', error);
    return {
      status: 'failed',
      error: error.message
    };
  }
}

/**
 * Stage: Promotion
 */
async function runPromotion(
  runId: number,
  params: PipelineParams
): Promise<{ status: 'complete' | 'failed'; storiesPromoted?: number; error?: string }> {
  console.log('[Orchestrator] Stage: Promotion');
  
  try {
    await updateRunStage(runId, 'promotion', 'promoting');
    
    const result = await promoteToLive(runId, params.categories);
    
    if (!result.success) {
      return {
        status: 'failed',
        error: result.errors.join(', ')
      };
    }
    
    return {
      status: 'complete',
      storiesPromoted: result.promoted.stories
    };
    
  } catch (error: any) {
    console.error('[Orchestrator] Promotion failed:', error);
    return {
      status: 'failed',
      error: error.message
    };
  }
}

/**
 * Main orchestrator function
 * Chains all pipeline stages
 */
export async function runPipeline(
  operation: PipelineOperation,
  params: PipelineParams,
  triggerSource: TriggerSource,
  triggerContext?: TriggerContext
): Promise<PipelineResult> {
  const startTime = Date.now();
  
  console.log(`[Orchestrator] Starting pipeline: ${operation}`);
  console.log(`[Orchestrator] Params:`, params);
  console.log(`[Orchestrator] Trigger:`, triggerSource);
  
  const result: PipelineResult = {
    success: false,
    operation,
    stages: {},
    errors: []
  };
  
  try {
    // Handle re-analysis separately (no staging pipeline)
    if (operation === 'reanalyze_category') {
      console.log('[Orchestrator] Re-analysis operation (direct update, no staging)');
      
      if (!params.analysisTypes || params.analysisTypes.length === 0) {
        result.errors.push('reanalyze_category requires params.analysisTypes');
        result.duration = Date.now() - startTime;
        return result;
      }
      
      try {
        // Run re-analysis (direct live database updates)
        const reanalysisResult = await reanalyzeArticles({
          category: params.category,
          articleIds: params.articleIds,
          analysisTypes: params.analysisTypes
        });
        
        result.stages.analysis = {
          status: reanalysisResult.errors.length === 0 ? 'complete' : 'failed',
          jobsCompleted: reanalysisResult.articlesProcessed,
          error: reanalysisResult.errors.join(', ') || undefined
        };
        
        result.success = reanalysisResult.errors.length === 0 || reanalysisResult.articlesProcessed > 0;
        result.duration = reanalysisResult.duration;
        result.errors = reanalysisResult.errors;
        
        console.log(`[Orchestrator] ✅ Re-analysis complete in ${(result.duration / 1000).toFixed(2)}s`);
        console.log(`  Articles processed: ${reanalysisResult.articlesProcessed}`);
        console.log(`  Viewpoints updated: ${reanalysisResult.viewpointsUpdated}`);
        console.log(`  Errors: ${reanalysisResult.errors.length}`);
        
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('[Orchestrator] Re-analysis failed:', errorMsg);
        
        result.success = false;
        result.errors.push(errorMsg);
        result.duration = Date.now() - startTime;
        result.stages.analysis = {
          status: 'failed',
          error: errorMsg
        };
        
        return result;
      }
    }
    
    // Create run
    const runId = await createRun(operation, params, triggerSource, triggerContext);
    result.runId = runId;
    console.log(`[Orchestrator] Created run ${runId}`);
    
    // Initialize category status
    let categories: Category[] = [];
    if (operation === 'full_refresh') {
      categories = ['top', 'breaking', 'technology', 'domestic', 'business', 'crime', 'entertainment', 'politics', 'science', 'world'];
    } else if (operation === 'refresh_categories' && params.categories) {
      categories = params.categories;
    } else if (operation === 'search_news') {
      categories = ['breaking']; // Default to breaking for keyword searches
    }
    
    if (categories.length > 0) {
      await initCategoryStatus(runId, categories, params.articlesPerCategory || 5);
    }
    
    // STAGE 1: Ingestion
    const ingestionResult = await runIngestion(runId, operation, params);
    result.stages.ingestion = ingestionResult;
    
    if (ingestionResult.status === 'failed') {
      result.errors.push(ingestionResult.error || 'Ingestion failed');
      result.duration = Date.now() - startTime;
      return result;
    }
    
    // STAGE 2: Deduplication
    const dedupResult = await runDeduplication(runId);
    result.stages.deduplication = dedupResult;
    
    if (dedupResult.status === 'failed') {
      result.errors.push(dedupResult.error || 'Deduplication failed');
      result.duration = Date.now() - startTime;
      return result;
    }
    
    // STAGE 3: Validation
    const validationResult = await runValidation(runId, params);
    result.stages.validation = validationResult;
    
    if (validationResult.status === 'failed') {
      result.errors.push(validationResult.error || 'Validation failed');
      result.duration = Date.now() - startTime;
      return result;
    }
    
    // STAGE 4: Analysis (optional)
    const analysisResult = await runAnalysis(runId);
    result.stages.analysis = analysisResult;
    
    if (analysisResult.status === 'failed') {
      result.errors.push(analysisResult.error || 'Analysis failed');
      // Don't stop - promotion can still proceed
    }
    
    // STAGE 5: Promotion
    const promotionResult = await runPromotion(runId, params);
    result.stages.promotion = promotionResult;
    
    if (promotionResult.status === 'failed') {
      result.errors.push(promotionResult.error || 'Promotion failed');
      result.duration = Date.now() - startTime;
      return result;
    }
    
    // Success!
    result.success = true;
    result.duration = Date.now() - startTime;
    
    console.log(`[Orchestrator] ✅ Pipeline complete in ${(result.duration / 1000).toFixed(2)}s`);
    
    return result;
    
  } catch (error: any) {
    console.error('[Orchestrator] Pipeline failed:', error);
    result.errors.push(error.message);
    result.duration = Date.now() - startTime;
    
    // Update run to failed
    if (result.runId) {
      await turso.execute({
        sql: `UPDATE pipeline_runs 
              SET status = 'failed', 
                  error_message = ?, 
                  completed_at = datetime('now') 
              WHERE id = ?`,
        args: [error.message, result.runId]
      });
    }
    
    return result;
  }
}

/**
 * Get pipeline status for a run
 */
export async function getPipelineStatus(runId: number): Promise<{
  run: {
    id: number;
    operation: PipelineOperation;
    status: string;
    currentStage: string | null;
    startedAt: string;
    completedAt: string | null;
    error: string | null;
  };
  validation?: any;
  promotion?: any;
}> {
  const runResult = await turso.execute({
    sql: 'SELECT * FROM pipeline_runs WHERE id = ?',
    args: [runId]
  });
  
  if (runResult.rows.length === 0) {
    throw new Error(`Run ${runId} not found`);
  }
  
  const run = runResult.rows[0] as any;
  
  const [validation, promotion] = await Promise.all([
    getValidationSummary(runId),
    getPromotionSummary(runId)
  ]);
  
  return {
    run: {
      id: run.id,
      operation: run.run_type,
      status: run.status,
      currentStage: run.current_stage,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      error: run.error_message
    },
    validation,
    promotion
  };
}
