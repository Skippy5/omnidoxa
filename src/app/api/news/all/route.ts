/**
 * API Route: Get all news data (Newsdata.io + Grok)
 * GET /api/news/all - Return cached news articles, movies, and local news
 */

import { NextResponse } from 'next/server';
import { getCachedArticles } from '@/lib/newsdata';
import { getCachedGrokData } from '@/lib/grok';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get cached data
    const newsCache = await getCachedArticles();
    const grokCache = await getCachedGrokData();

    if (!newsCache && !grokCache) {
      return NextResponse.json({
        success: false,
        error: 'No cached data available. Please run /api/news/fetch and /api/grok/fetch first.'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      news: newsCache ? {
        lastUpdated: newsCache.lastUpdated,
        articles: newsCache.articles,
        articleCount: Object.values(newsCache.articles).flat().length
      } : null,
      grok: grokCache ? {
        lastUpdated: grokCache.lastUpdated,
        data: grokCache.data,
        movieCount: grokCache.data.movies.length
      } : null
    });

  } catch (error) {
    console.error('Error fetching all news:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
