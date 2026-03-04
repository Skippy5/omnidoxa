/**
 * API Route: Refresh stories
 * POST /api/stories/refresh - Fetch fresh news and trigger background analysis
 */

import { NextResponse } from 'next/server';
import { GET as newsFetchHandler } from '@/app/api/news/fetch/route';

export async function POST(request: Request) {
  try {
    console.log('🔄 Refreshing stories...');
    
    // Create a mock request with refresh=true query param
    const baseUrl = new URL(request.url).origin;
    const mockFetchUrl = new URL(`${baseUrl}/api/news/fetch?refresh=true`);
    const mockRequest = new Request(mockFetchUrl.toString(), {
      method: 'GET',
      headers: request.headers
    });
    
    console.log(`📡 Calling news fetch handler directly (avoiding serverless fetch loop)`);
    
    // Call the handler directly instead of HTTP fetch (avoids serverless function network issues)
    const newsResponse = await newsFetchHandler(mockRequest);
    const newsData = await newsResponse.json();
    
    if (!newsData.success) {
      throw new Error('Failed to fetch news articles');
    }
    
    // Handle both progressive mode and cache mode responses
    const articleCount = newsData.articleCount || (newsData.totalCategories * 5) || 0;
    
    console.log(`✅ Progressive fetch triggered for ${newsData.totalCategories || 'all'} categories`);
    console.log('🧠 Sentiment analysis running in background...');
    
    return NextResponse.json({
      success: true,
      articlesRefreshed: articleCount,
      mode: newsData.source || 'progressive',
      message: 'Articles fetching in progress! Check back in 2-3 minutes for updated stories with analysis.'
    });

  } catch (error) {
    console.error('❌ Error refreshing stories:', error);
    const message = error instanceof Error ? error.message : 'Failed to refresh stories';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
