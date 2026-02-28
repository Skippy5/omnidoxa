/**
 * API Route: Pipeline Status
 * GET /api/pipeline/status?runId=X
 * 
 * Get the status, progress, and stats for a pipeline run.
 * Part of Phase 1.14 - OmniDoxa Pipeline Redesign
 */

import { NextResponse } from 'next/server';
import { getRunStatus } from '@/lib/pipeline/run-manager';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const runIdParam = searchParams.get('runId');
    
    if (!runIdParam) {
      return NextResponse.json(
        { error: 'Missing required parameter: runId' },
        { status: 400 }
      );
    }
    
    const runId = parseInt(runIdParam, 10);
    
    if (isNaN(runId) || runId <= 0) {
      return NextResponse.json(
        { error: 'Invalid runId: must be a positive integer' },
        { status: 400 }
      );
    }
    
    // Get run status
    const status = await getRunStatus(runId);
    
    if (!status) {
      return NextResponse.json(
        { error: `Run not found: ${runId}` },
        { status: 404 }
      );
    }
    
    const { run, progress, stats, errors } = status;
    
    // Parse config for display
    let config: any = {};
    try {
      config = JSON.parse(run.config);
    } catch (e) {
      console.error('Failed to parse run config:', e);
    }
    
    // Build response
    const response: any = {
      runId: run.id,
      operation: run.run_type,
      status: run.status,
      progress: {
        stage: progress.stage,
        percent: progress.percent,
        message: progress.message
      },
      stats: {
        articlesProcessed: stats.articlesProcessed,
        articlesTotal: stats.articlesTotal,
        analysisComplete: stats.analysisJobsComplete,
        analysisTotal: stats.analysisJobsTotal
      },
      config,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      errors: errors.length > 0 ? errors : undefined
    };
    
    // Add per-category breakdown if available
    const categoryBreakdown = await getCategoryBreakdown(runId);
    if (categoryBreakdown && categoryBreakdown.length > 0) {
      response.categoryBreakdown = categoryBreakdown;
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Error fetching pipeline status:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch pipeline status',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Get per-category breakdown if category_status table has data
 */
async function getCategoryBreakdown(runId: number): Promise<any[] | null> {
  try {
    const { turso } = await import('@/lib/db-turso');
    
    const result = await turso.execute({
      sql: `
        SELECT 
          category,
          target_count,
          current_count,
          pull_attempts,
          status,
          updated_at
        FROM category_status 
        WHERE run_id = ?
        ORDER BY category
      `,
      args: [runId]
    });
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows.map(row => ({
      category: row.category,
      targetCount: Number(row.target_count),
      currentCount: Number(row.current_count),
      pullAttempts: Number(row.pull_attempts),
      status: row.status,
      updatedAt: row.updated_at
    }));
    
  } catch (error) {
    // Category breakdown is optional - don't fail the whole request
    console.warn('Could not fetch category breakdown:', error);
    return null;
  }
}
