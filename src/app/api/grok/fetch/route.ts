/**
 * API Route: Fetch movies and local news from xAI Grok
 * GET /api/grok/fetch - Fetch and cache Grok data
 */

import { NextResponse } from 'next/server';
import {
  fetchGrokData,
  getCachedGrokData,
  saveCachedGrokData
} from '@/lib/grok';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await getCachedGrokData();
      if (cached) {
        const cacheAge = Date.now() - new Date(cached.lastUpdated).getTime();
        const maxAge = 60 * 60 * 1000; // 1 hour

        if (cacheAge < maxAge) {
          return NextResponse.json({
            success: true,
            source: 'cache',
            lastUpdated: cached.lastUpdated,
            data: cached.data,
            movieCount: cached.data.movies.length,
            newsCategories: Object.keys(cached.data.news).length
          });
        }
      }
    }

    console.log('🤖 Fetching fresh data from xAI Grok...');
    
    // Fetch from Grok
    const data = await fetchGrokData();
    
    console.log(`✅ Fetched ${data.movies.length} movies and news from ${Object.keys(data.news).length} categories`);

    // Save to cache
    await saveCachedGrokData(data);

    return NextResponse.json({
      success: true,
      source: 'fresh',
      lastUpdated: new Date().toISOString(),
      data,
      movieCount: data.movies.length,
      newsCategories: Object.keys(data.news).length
    });

  } catch (error) {
    console.error('Error fetching Grok data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
