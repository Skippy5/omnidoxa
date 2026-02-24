/**
 * API Route: Fetch single category (for cron-based updates)
 * GET /api/news/fetch-category?category=politics&secret=xxx
 * 
 * Designed to run as individual cron jobs to avoid timeout issues.
 * Each category completes in <10 seconds (fits Vercel Hobby plan).
 */

import { NextResponse } from 'next/server';
import {
  fetchCategoryArticles,
  saveCachedArticles,
  getCachedArticles,
  normalizeUrl,
  NEWSDATA_CATEGORIES,
  type NewsdataArticle,
  type NewsdataCategory
} from '@/lib/newsdata';
import { FetchLogger } from '@/lib/fetch-logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 minute (plenty for single category)

const ARTICLES_PER_CATEGORY = 5;

/**
 * Normalize a title for deduplication (lowercase, strip punctuation/whitespace)
 */
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Check if an article is a duplicate by URL or title
 */
function isDuplicate(
  article: NewsdataArticle,
  seenUrls: Set<string>,
  seenTitles: Set<string>
): { isDup: boolean; reason?: string } {
  const normUrl = normalizeUrl(article.link);
  if (seenUrls.has(normUrl)) {
    return { isDup: true, reason: 'duplicate URL' };
  }

  const normTitle = normalizeTitle(article.title);
  if (seenTitles.has(normTitle)) {
    return { isDup: true, reason: 'duplicate title' };
  }

  return { isDup: false };
}

/**
 * Mark an article as seen in dedup sets
 */
function markSeen(
  article: NewsdataArticle,
  seenUrls: Set<string>,
  seenTitles: Set<string>
): void {
  seenUrls.add(normalizeUrl(article.link));
  seenTitles.add(normalizeTitle(article.title));
}

/**
 * Create fallback story when xAI analysis times out
 */
function createFallbackStory(article: NewsdataArticle, category: string, index: number): any {
  return {
    id: index,
    title: article.title,
    description: article.description || article.content || 'No description available',
    url: article.link,
    source: article.source_name || article.source_id || 'Unknown',
    image_url: article.image_url || null,
    category: category,
    created_at: new Date().toISOString(),
    viewpoints: [] // Empty viewpoints when analysis fails
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Authenticate: require CRON_SECRET via header or query param
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const headerAuth = request.headers.get('authorization');
      const headerToken = headerAuth?.startsWith('Bearer ') ? headerAuth.slice(7) : null;
      const queryToken = searchParams.get('secret');
      if (headerToken !== cronSecret && queryToken !== cronSecret) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Get category from query param
    const category = searchParams.get('category');
    if (!category || !NEWSDATA_CATEGORIES.includes(category as NewsdataCategory)) {
      return NextResponse.json(
        { success: false, error: `Invalid category. Must be one of: ${NEWSDATA_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    console.log(`🔄 Fetching category: ${category.toUpperCase()}`);
    const logger = new FetchLogger();
    logger.logFetchStart(category);

    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();

    // Fetch articles (50 pool → dedupe to 5)
    console.log(`  ⬇️  Fetching pool of 50 articles from ${category}...`);
    const articles = await fetchCategoryArticles(category as NewsdataCategory, ARTICLES_PER_CATEGORY, seenUrls, 50);

    // Deduplicate
    const uniqueArticles: NewsdataArticle[] = [];
    let skipped = 0;
    for (const article of articles) {
      const { isDup, reason } = isDuplicate(article, seenUrls, seenTitles);
      if (isDup) {
        console.log(`  ⏭️  Skipping ${reason}: ${article.title.substring(0, 50)}...`);
        skipped++;
        continue;
      }
      markSeen(article, seenUrls, seenTitles);
      uniqueArticles.push(article);
      if (uniqueArticles.length >= ARTICLES_PER_CATEGORY) break;
    }

    console.log(`  ✅ Fetched ${uniqueArticles.length}/${ARTICLES_PER_CATEGORY} unique ${category} articles (${skipped} duplicates skipped)`);
    logger.logFetchComplete(category, uniqueArticles.length);

    // Clear old articles for this category
    const { clearCategoryArticles } = await import('@/lib/db-cloud');
    const clearedCount = await clearCategoryArticles(category as any);
    if (clearedCount > 0) {
      console.log(`  🗑️  Cleared ${clearedCount} old ${category} articles`);
    }

    // Analyze and save each article
    logger.logAnalysisStart(category);
    const { convertToStoryWithTwitterPipeline } = await import('@/lib/convert-with-twitter-pipeline');
    const { saveStoryWithViewpoints } = await import('@/lib/db-cloud');

    let savedCount = 0;
    let fallbackCount = 0;

    for (let i = 0; i < uniqueArticles.length; i++) {
      try {
        console.log(`  📊 [${i + 1}/${uniqueArticles.length}] Analyzing: ${uniqueArticles[i].title.substring(0, 60)}...`);

        const story = await convertToStoryWithTwitterPipeline(uniqueArticles[i], i + 1, category);
        await saveStoryWithViewpoints(story);

        const tweetCount = story.viewpoints.reduce((sum, vp) => sum + vp.social_posts.length, 0);
        console.log(`  ✅ [${i + 1}/${uniqueArticles.length}] Saved with ${tweetCount} tweets`);
        logger.logArticleAnalyzed(category, i + 1, uniqueArticles[i].title, tweetCount);
        savedCount++;

        // Rate limiting: 2 seconds between articles
        if (i < uniqueArticles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ Failed to analyze article ${i + 1}:`, errorMsg);
        
        // FALLBACK: Save article without analysis (prevents data loss)
        try {
          const fallbackStory = createFallbackStory(uniqueArticles[i], category, i + 1);
          await saveStoryWithViewpoints(fallbackStory);
          console.log(`  ⚠️  Saved article ${i + 1} with fallback (no tweets)`);
          fallbackCount++;
        } catch (fallbackError) {
          console.error(`  💥 Fallback save also failed:`, fallbackError);
          logger.logError(category, `Article ${i + 1} total failure: ${errorMsg}`);
        }
      }
    }

    logger.logAnalysisComplete(category);

    // Update cache
    const cached = await getCachedArticles() || { articles: {}, lastUpdated: new Date().toISOString() };
    cached.articles[category] = uniqueArticles;
    cached.lastUpdated = new Date().toISOString();
    await saveCachedArticles(cached.articles as any);

    console.log(`✅ Category ${category} complete: ${savedCount} analyzed, ${fallbackCount} fallback saves`);

    return NextResponse.json({
      success: true,
      category,
      fetched: uniqueArticles.length,
      saved: savedCount,
      fallbacks: fallbackCount,
      cleared: clearedCount
    });

  } catch (error) {
    console.error('Error fetching category:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
