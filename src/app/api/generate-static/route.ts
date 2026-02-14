/**
 * API Route: Generate static stories.json
 * GET /api/generate-static?secret=XXX
 * 
 * Fetches 50 articles and writes to public/stories.json
 * Called by GitHub Actions to generate static content
 */

import { NextResponse } from 'next/server';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fetchCategoryArticles, NEWSDATA_CATEGORIES } from '@/lib/newsdata';
import { convertToStoryWithGrok4Direct } from '@/lib/grok4-sentiment-direct';
import type { StoryWithViewpoints } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function GET(request: Request) {
  // Security: require secret
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  if (secret !== process.env.GENERATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  console.log('🌐 Generating static stories.json...');
  
  const stories: StoryWithViewpoints[] = [];
  let storyId = 1;
  const seenUrls = new Set<string>();
  
  for (const category of NEWSDATA_CATEGORIES) {
    console.log(`📰 Fetching ${category}...`);
    
    try {
      // Fetch 5 articles for this category
      const articles = await fetchCategoryArticles(category, 5, seenUrls, 50);
      
      console.log(`  ✅ Got ${articles.length} articles`);
      
      // Convert to story format with sentiment
      for (const article of articles) {
        const story = await convertToStoryWithGrok4Direct(article, storyId++, category);
        stories.push(story);
      }
      
      // Rate limiting between categories
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`  ❌ Failed to fetch ${category}:`, error instanceof Error ? error.message : error);
    }
  }
  
  console.log(`\n📊 Total stories: ${stories.length}/50`);
  
  // Create output object
  const output = {
    stories,
    fetched_at: new Date().toISOString(),
    total: stories.length,
    categories: NEWSDATA_CATEGORIES.reduce((acc, cat) => {
      acc[cat as string] = stories.filter(s => s.category === cat).length;
      return acc;
    }, {} as Record<string, number>)
  };
  
  // Write to public/stories.json (works locally, not on Vercel)
  if (process.env.NODE_ENV === 'development') {
    const outputPath = join(process.cwd(), 'public', 'stories.json');
    mkdirSync(join(process.cwd(), 'public'), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`✅ Written to ${outputPath}`);
  }
  
  // Return JSON for GitHub Actions to save
  return NextResponse.json({
    success: true,
    ...output
  });
}
