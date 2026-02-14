/**
 * API Route: Refresh stories
 * POST /api/stories/refresh - Fetch fresh news and trigger background analysis
 */

import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('🔄 Refreshing stories...');
    
    // Trigger news fetch (which will trigger background analysis)
    const newsResponse = await fetch('http://localhost:3000/api/news/fetch?refresh=true');
    const newsData = await newsResponse.json();
    
    if (!newsData.success) {
      throw new Error('Failed to fetch news articles');
    }
    
    console.log(`✅ Fetched ${newsData.articleCount} articles`);
    console.log('🧠 Sentiment analysis running in background...');
    
    return NextResponse.json({
      success: true,
      articlesRefreshed: newsData.articleCount,
      message: 'Articles fetched! Sentiment analysis running in background. Refresh page in 2-3 minutes for updated stories with tweets.'
    });

  } catch (error) {
    console.error('❌ Error refreshing stories:', error);
    const message = error instanceof Error ? error.message : 'Failed to refresh stories';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
