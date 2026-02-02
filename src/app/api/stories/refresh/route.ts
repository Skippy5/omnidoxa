import { NextResponse } from 'next/server';
import { fetchAllStories } from '@/lib/gemini-news';
import { upsertStory, getAllStories } from '@/lib/db';

export async function POST() {
  try {
    const freshStories = await fetchAllStories();

    for (const story of freshStories) {
      upsertStory(story);
    }

    const stories = getAllStories();
    return NextResponse.json({
      stories,
      fetched: freshStories.length,
    });
  } catch (error) {
    console.error('Error refreshing stories:', error);
    const message = error instanceof Error ? error.message : 'Failed to refresh stories';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
