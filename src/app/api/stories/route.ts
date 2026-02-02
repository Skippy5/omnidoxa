import { NextRequest, NextResponse } from 'next/server';
import { getAllStories } from '@/lib/db';
import type { Category } from '@/lib/types';

const VALID_CATEGORIES = new Set(['politics', 'crime', 'us', 'international', 'science_tech']);

export async function GET(request: NextRequest) {
  try {
    const category = request.nextUrl.searchParams.get('category');

    if (category && !VALID_CATEGORIES.has(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const stories = getAllStories(category as Category | undefined);
    return NextResponse.json({ stories });
  } catch (error) {
    console.error('Error fetching stories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stories' },
      { status: 500 }
    );
  }
}
