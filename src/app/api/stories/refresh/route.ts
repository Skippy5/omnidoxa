/**
 * API Route: Refresh stories
 * POST /api/stories/refresh - Fetch fresh news and trigger background analysis
 */

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    console.log('🔄 Refreshing stories...');
    
    // Get the base URL from the request (works in both dev and production)
    const baseUrl = new URL(request.url).origin;
    
    // Trigger news fetch (which will trigger background analysis)
    const newsResponse = await fetch(`${baseUrl}/api/news/fetch?refresh=true`);
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
