/**
 * API Route: Get OmniDoxa stories
 * GET /api/stories - Return stories from database (instant load)
 */

import { NextResponse } from 'next/server';
import { getAllStories, hasStories, getLastFetchTime } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Just read from database - instant!
    const stories = getAllStories();
    const lastFetch = getLastFetchTime();
    
    if (stories.length === 0) {
      return NextResponse.json({
        stories: [],
        fetched_at: null,
        message: 'No stories yet. Fetching and analyzing articles in background... Refresh in 2-3 minutes!'
      });
    }
    
    return NextResponse.json({
      stories,
      fetched_at: lastFetch || new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error loading stories:', error);
    return NextResponse.json(
      { 
        stories: [],
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
