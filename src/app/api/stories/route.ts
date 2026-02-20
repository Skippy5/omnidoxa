/**
 * API Route: Get OmniDoxa stories
 * GET /api/stories - Return stories from database (instant load)
 * GET /api/stories?category=politics - Return stories filtered by category
 */

import { NextResponse } from 'next/server';
import { getAllStories, hasStories, getLastFetchTime } from '@/lib/db-cloud';
import type { Category } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Extract category from query params
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as Category | null;
    
    // Read from cloud database with optional category filter
    const stories = await getAllStories(category || undefined);
    const lastFetch = await getLastFetchTime();
    
    if (stories.length === 0) {
      return NextResponse.json({
        stories: [],
        fetched_at: null,
        message: category 
          ? `No ${category} stories yet. Try fetching first!`
          : 'No stories yet. Fetching and analyzing articles in background... Refresh in 2-3 minutes!'
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
