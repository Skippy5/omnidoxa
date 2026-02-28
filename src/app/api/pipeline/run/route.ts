/**
 * API Route: Pipeline Run
 * POST /api/pipeline/run
 * 
 * Unified endpoint for triggering pipeline operations.
 * Part of Phase 1.13 - OmniDoxa Pipeline Redesign
 */

import { NextResponse } from 'next/server';
import { createRun, estimateDuration } from '@/lib/pipeline/run-manager';
import type { RunType, TriggerSource, RunConfig } from '@/lib/db-staging';
import { runPipeline } from '@/lib/pipeline/orchestrator';
import type { PipelineOperation, PipelineParams, TriggerContext } from '@/lib/pipeline/orchestrator';

export const dynamic = 'force-dynamic';

interface RunRequest {
  operation: RunType;
  params: RunConfig;
  trigger_source: TriggerSource;
  trigger_context?: TriggerContext;
}

export async function POST(request: Request) {
  try {
    const body: RunRequest = await request.json();
    
    // Validate operation type
    const validOperations: RunType[] = [
      'category_refresh',
      'keyword_search',
      'full_refresh',
      'reanalyze_category'
    ];
    
    if (!validOperations.includes(body.operation)) {
      return NextResponse.json(
        { 
          error: 'Invalid operation type',
          validOperations 
        },
        { status: 400 }
      );
    }
    
    // Validate trigger source
    const validSources: TriggerSource[] = ['cron', 'manual', 'conversational'];
    if (!validSources.includes(body.trigger_source)) {
      return NextResponse.json(
        { 
          error: 'Invalid trigger source',
          validSources 
        },
        { status: 400 }
      );
    }
    
    // Validate params based on operation
    const validationError = validateParams(body.operation, body.params);
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }
    
    // Execute pipeline via orchestrator
    // The orchestrator handles run creation, locking, and all stages
    let pipelineResult;
    try {
      pipelineResult = await runPipeline(
        body.operation as PipelineOperation,
        body.params as PipelineParams,
        body.trigger_source,
        body.trigger_context
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('another pipeline run is already in progress')) {
        return NextResponse.json(
          { 
            error: 'A pipeline run is already in progress. Please wait for it to complete.',
            status: 'locked'
          },
          { status: 409 }
        );
      }
      throw error;
    }
    
    // Estimate duration
    const estimatedDuration = estimateDuration(body.operation, body.params);
    
    console.log(`🚀 Pipeline completed for run ${pipelineResult.runId}`);
    console.log(`⏱️  Duration: ${pipelineResult.duration}ms`);
    console.log(`✅ Success: ${pipelineResult.success}`);
    
    return NextResponse.json({
      runId: pipelineResult.runId,
      operation: body.operation,
      status: pipelineResult.success ? 'complete' : 'failed',
      estimatedDuration,
      duration: pipelineResult.duration,
      stages: pipelineResult.stages,
      errors: pipelineResult.errors,
      message: pipelineResult.success 
        ? `Pipeline run ${pipelineResult.runId} completed successfully.`
        : `Pipeline run ${pipelineResult.runId} failed: ${pipelineResult.errors.join(', ')}`
    });
    
  } catch (error) {
    console.error('❌ Error creating pipeline run:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create pipeline run',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Validate params based on operation type
 */
function validateParams(operation: RunType, params: RunConfig): string | null {
  switch (operation) {
    case 'category_refresh':
      if (!params.categories || !Array.isArray(params.categories) || params.categories.length === 0) {
        return 'category_refresh requires params.categories (non-empty array)';
      }
      
      const validCategories = [
        'breaking', 'business', 'crime', 'entertainment', 'politics',
        'science', 'top', 'world', 'technology', 'domestic'
      ];
      
      for (const cat of params.categories) {
        if (!validCategories.includes(cat)) {
          return `Invalid category: ${cat}. Valid categories: ${validCategories.join(', ')}`;
        }
      }
      break;
      
    case 'keyword_search':
      if (!params.keywords || typeof params.keywords !== 'string' || params.keywords.trim().length === 0) {
        return 'keyword_search requires params.keywords (non-empty string)';
      }
      break;
      
    case 'reanalyze_category':
      // Validate analysisTypes (required)
      if (!params.analysisTypes || !Array.isArray(params.analysisTypes) || params.analysisTypes.length === 0) {
        return 'reanalyze_category requires params.analysisTypes (non-empty array)';
      }
      
      const validAnalysisTypes = ['twitter', 'reddit', 'ai_sentiment'];
      for (const type of params.analysisTypes) {
        if (!validAnalysisTypes.includes(type)) {
          return `Invalid analysis type: ${type}. Valid types: ${validAnalysisTypes.join(', ')}`;
        }
      }
      
      // Validate filter (at least one filter criterion required)
      const hasFilter = params.category || 
                       (params.categories && params.categories.length > 0) ||
                       (params.articleIds && params.articleIds.length > 0) ||
                       params.dateRange;
      
      if (!hasFilter) {
        return 'reanalyze_category requires at least one filter: category, categories, articleIds, or dateRange';
      }
      
      // Validate categories if provided
      if (params.category || params.categories) {
        const validCategories = [
          'breaking', 'business', 'crime', 'entertainment', 'politics',
          'science', 'top', 'world', 'technology', 'domestic'
        ];
        
        const categoriesToValidate = params.categories || [params.category];
        for (const cat of categoriesToValidate) {
          if (cat && !validCategories.includes(cat)) {
            return `Invalid category: ${cat}. Valid categories: ${validCategories.join(', ')}`;
          }
        }
      }
      break;
      
    case 'full_refresh':
      // No required params for full refresh
      break;
      
    default:
      return `Unknown operation: ${operation}`;
  }
  
  return null;
}
