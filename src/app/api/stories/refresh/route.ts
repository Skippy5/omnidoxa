/**
 * API Route: Refresh stories
 * POST /api/stories/refresh - Fetch fresh news and trigger background analysis
 */

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    console.log('🔄 Refreshing stories - TEST MODE...');
    
    // Dynamic import to avoid edge runtime issues
    const { GET as newsFetchHandler } = await import('@/app/api/news/fetch/route');
    
    // Create a mock request with refresh=true query param
    const baseUrl = new URL(request.url).origin;
    const mockFetchUrl = new URL(`${baseUrl}/api/news/fetch?refresh=true`);
    const mockRequest = new Request(mockFetchUrl.toString(), {
      method: 'GET',
      headers: request.headers
    });
    
    console.log(`📡 Calling news fetch handler directly...`);
    
    // Call the handler directly instead of HTTP fetch
    const newsResponse = await newsFetchHandler(mockRequest);
    
    // Check if response is ok
    if (!newsResponse.ok) {
      console.error(`❌ News handler returned status ${newsResponse.status}`);
      throw new Error(`News handler failed with status ${newsResponse.status}`);
    }
    
    const newsData = await newsResponse.json();
    console.log(`📊 News handler response:`, JSON.stringify(newsData));
    
    if (!newsData.success) {
      throw new Error('News handler returned success:false');
    }
    
    // Handle both progressive mode and cache mode responses
    const articleCount = newsData.articleCount || (newsData.totalCategories * 5) || 0;
    
    console.log(`✅ Progressive fetch triggered for ${newsData.totalCategories || 'all'} categories`);
    
    return NextResponse.json({
      success: true,
      articlesRefreshed: articleCount,
      mode: newsData.source || 'progressive',
      message: 'Articles fetching in progress! Check back in 2-3 minutes for updated stories with analysis.'
    });

  } catch (error) {
    // Detailed error logging
    console.error('❌ Error refreshing stories:');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'no stack');
    
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      error: message,
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
