/**
 * API Route: Twitter Analysis (SIMPLIFIED FOR TESTING)
 * POST /api/pipeline/analyze/twitter
 * 
 * Analyzes live articles directly without staging tables.
 * This bypasses the full pipeline workflow for testing purposes.
 * 
 * Phase: 2.4 - API Endpoint for Twitter Analysis (TEST VERSION)
 * Created: 2026-02-28
 */

import { NextResponse } from 'next/server';
import { analyzeArticleTwitter } from '@/lib/pipeline/analysis/twitter';
import { turso } from '@/lib/db-turso';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel timeout limit

interface AnalyzeRequest {
  articleIds: number[];    // Story IDs from live stories table
  limit?: number;          // Max articles to process (default: 10)
}

interface AnalyzeResponse {
  processed: number;
  failed: number;
  errors?: Array<{ articleId: number; error: string }>;
  results?: Array<{
    articleId: number;
    viewpoints: number;
    socialPosts: number;
  }>;
}

export async function POST(request: Request) {
  try {
    const body: AnalyzeRequest = await request.json();
    
    // 1. VALIDATE INPUT
    if (!body.articleIds || !Array.isArray(body.articleIds) || body.articleIds.length === 0) {
      return NextResponse.json(
        { error: 'articleIds must be a non-empty array of numbers' },
        { status: 400 }
      );
    }
    
    const limit = body.limit || 10;
    const articlesToProcess = body.articleIds.slice(0, limit);
    
    console.log(`\n🚀 Starting Twitter analysis...`);
    console.log(`   Article IDs: ${articlesToProcess.join(', ')}`);
    
    // 2. PROCESS EACH ARTICLE
    let processed = 0;
    let failed = 0;
    const errors: Array<{ articleId: number; error: string }> = [];
    const results: Array<{ articleId: number; viewpoints: number; socialPosts: number }> = [];
    
    for (const articleId of articlesToProcess) {
      try {
        console.log(`\n  📊 Analyzing article #${articleId}...`);
        
        // Look up run_id from staging_articles
        const articleQuery = await turso.execute({
          sql: 'SELECT run_id, title FROM staging_articles WHERE id = ?',
          args: [articleId]
        });
        
        if (!articleQuery.rows || articleQuery.rows.length === 0) {
          throw new Error(`Article not found: id=${articleId}`);
        }
        
        const runId = articleQuery.rows[0].run_id as number;
        console.log(`  🏃 run_id=${runId}, article_id=${articleId}`);
        
        // Call Twitter analysis
        const analysisResult = await analyzeArticleTwitter(runId, articleId);
        
        // Write results to STAGING tables
        // Delete existing staging data first
        await turso.execute({
          sql: `DELETE FROM staging_social_posts WHERE run_id = ? AND article_id = ?`,
          args: [runId, articleId]
        });
        
        await turso.execute({
          sql: `DELETE FROM staging_viewpoints WHERE run_id = ? AND article_id = ?`,
          args: [runId, articleId]
        });
        
        // Insert staging viewpoints
        const viewpointIds: number[] = [];
        for (const vp of analysisResult.viewpoints) {
          const insertResult = await turso.execute({
            sql: `INSERT INTO staging_viewpoints 
                  (run_id, article_id, lean, summary, sentiment_score, created_at) 
                  VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
            args: [
              runId,
              articleId,
              vp.lean,
              vp.sentiment_score,
              vp.summary,
              new Date().toISOString()
            ]
          });
          
          if (insertResult.rows && insertResult.rows.length > 0) {
            viewpointIds.push(insertResult.rows[0].id as number);
          }
        }
        
        // Insert staging social posts
        const leanToId: Record<string, number> = {
          left: viewpointIds[0],
          center: viewpointIds[1],
          right: viewpointIds[2]
        };
        
        for (const post of analysisResult.socialPosts) {
          const viewpointId = leanToId[post.viewpoint_lean];
          if (!viewpointId) continue;
          
          await turso.execute({
            sql: `INSERT INTO staging_social_posts 
                  (run_id, viewpoint_id, article_id, source, author, content, url, 
                   platform_id, likes, retweets, timestamp, is_real, 
                   political_leaning_source, created_at) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              runId,
              viewpointId,
              articleId,
              'twitter',
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
        
        processed++;
        results.push({
          articleId,
          viewpoints: viewpointIds.length,
          socialPosts: analysisResult.socialPosts.length
        });
        
        console.log(`  ✅ Article #${articleId} complete: ${viewpointIds.length} viewpoints, ${analysisResult.socialPosts.length} posts`);
        
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ Article #${articleId} failed: ${errorMsg}`);
        errors.push({ articleId, error: errorMsg });
      }
      
      // Rate limit: 2 seconds between articles
      if (articleId !== articlesToProcess[articlesToProcess.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`\n✅ Analysis complete: ${processed} processed, ${failed} failed`);
    
    // 3. RETURN RESPONSE
    const response: AnalyzeResponse = {
      processed,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      results: results.length > 0 ? results : undefined
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Twitter analysis API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error during Twitter analysis',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
