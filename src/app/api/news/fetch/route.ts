/**
 * API Route: Fetch news articles from Newsdata.io
 * GET /api/news/fetch - Fetch and analyze categories one at a time for progressive display
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await getCachedArticles();
      if (cached) {
        const cacheAge = Date.now() - new Date(cached.lastUpdated).getTime();
        const maxAge = 30 * 60 * 1000; // 30 minutes

        if (cacheAge < maxAge) {
          return NextResponse.json({
            success: true,
            source: 'cache',
            lastUpdated: cached.lastUpdated,
            articles: cached.articles,
            articleCount: Object.values(cached.articles).flat().length
          });
        }
      }
    }

    console.log('🌐 Starting progressive category fetch and analysis...');
    
    // Process categories ONE AT A TIME for progressive display
    triggerProgressiveFetchAndAnalysis().catch(err => {
      console.error('Progressive fetch error:', err);
    });

    return NextResponse.json({
      success: true,
      source: 'progressive',
      message: 'Progressive fetch started! Categories will be fetched and analyzed one at a time.',
      totalCategories: NEWSDATA_CATEGORIES.length
    });

  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

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

const ARTICLES_PER_CATEGORY = 5;
const EXPECTED_TOTAL = ARTICLES_PER_CATEGORY * NEWSDATA_CATEGORIES.length; // 50 (5 per category × 10 categories)

/**
 * Fetch and analyze categories one at a time for progressive display.
 * Ensures 5 unique articles per category across all 8 categories (40 total).
 */
async function triggerProgressiveFetchAndAnalysis(): Promise<void> {
  const logger = new FetchLogger();
  console.log(`🚀 Starting progressive category processing (${NEWSDATA_CATEGORIES.length} categories, ${ARTICLES_PER_CATEGORY} articles each, ${EXPECTED_TOTAL} total)...`);
  console.log(`📋 Categories: ${NEWSDATA_CATEGORIES.map(c => c.toUpperCase()).join(', ')}`);

  // Global dedup sets — shared across all categories
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();

  try {
    const { convertToStoryWithGrok4Direct } = await import('@/lib/grok4-sentiment-direct');
    const { saveStoryWithViewpoints } = await import('@/lib/db');

    const allArticles: Record<string, NewsdataArticle[]> = {};
    let totalProcessed = 0;
    let totalSkipped = 0;

    // Process each category sequentially
    for (let catIndex = 0; catIndex < NEWSDATA_CATEGORIES.length; catIndex++) {
      const category = NEWSDATA_CATEGORIES[catIndex];

      console.log(`\n📰 [${catIndex + 1}/${NEWSDATA_CATEGORIES.length}] Processing category: ${category.toUpperCase()}`);
      logger.logFetchStart(category);

      try {
        // Step 1: Fetch 50 articles, then deduplicate down to 5
        console.log(`  ⬇️  Fetching pool of 50 articles from ${category} (dedup → ${ARTICLES_PER_CATEGORY})...`);
        const articles = await fetchCategoryArticles(category, ARTICLES_PER_CATEGORY, seenUrls, 50);

        // Step 2: Apply title + URL dedup against global seen sets
        const uniqueArticles: NewsdataArticle[] = [];
        for (const article of articles) {
          const { isDup, reason } = isDuplicate(article, seenUrls, seenTitles);
          if (isDup) {
            console.log(`  ⏭️  Skipping ${reason}: ${article.title.substring(0, 50)}...`);
            totalSkipped++;
            continue;
          }
          markSeen(article, seenUrls, seenTitles);
          uniqueArticles.push(article);
          if (uniqueArticles.length >= ARTICLES_PER_CATEGORY) break;
        }

        allArticles[category] = uniqueArticles;

        console.log(`  ✅ Fetched ${uniqueArticles.length}/${ARTICLES_PER_CATEGORY} unique ${category} articles (${totalSkipped} total duplicates skipped)`);
        logger.logFetchComplete(category, uniqueArticles.length);

        if (uniqueArticles.length < ARTICLES_PER_CATEGORY) {
          console.log(`  ⚠️  Could only get ${uniqueArticles.length} articles for ${category} (API may have limited results)`);
        }

        // Step 4: Analyze and save each article immediately
        logger.logAnalysisStart(category);

        for (let i = 0; i < uniqueArticles.length; i++) {
          try {
            console.log(`  📊 [${i + 1}/${uniqueArticles.length}] Analyzing: ${uniqueArticles[i].title.substring(0, 60)}...`);

            const story = await convertToStoryWithGrok4Direct(uniqueArticles[i], totalProcessed + i + 1, category);

            saveStoryWithViewpoints(story);

            const tweetCount = story.viewpoints.reduce((sum, vp) => sum + vp.social_posts.length, 0);
            console.log(`  ✅ [${i + 1}/${uniqueArticles.length}] Saved with ${tweetCount} tweets`);

            logger.logArticleAnalyzed(category, i + 1, uniqueArticles[i].title, tweetCount);

            // Rate limiting: 2 seconds between articles
            if (i < uniqueArticles.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`  ❌ Failed to analyze article ${i + 1}:`, errorMsg);
            logger.logError(category, `Article ${i + 1} analysis failed: ${errorMsg}`);
          }
        }

        logger.logAnalysisComplete(category);
        totalProcessed += uniqueArticles.length;

        // Step 5: Update cache after each category completes
        await saveCachedArticles(allArticles as any);
        console.log(`  💾 Cache updated (${totalProcessed}/${EXPECTED_TOTAL} articles total)`);

        // Pause between categories (5 seconds)
        if (catIndex < NEWSDATA_CATEGORIES.length - 1) {
          console.log(`  ⏸️  Pausing 5s before next category...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ Failed to process ${category} category:`, errorMsg);
        logger.logError(category, `Category fetch failed: ${errorMsg}`);
        allArticles[category] = [];
      }
    }

    // Final verification
    const categoryCounts = NEWSDATA_CATEGORIES.map(cat => {
      const count = (allArticles[cat] || []).length;
      return `${cat}: ${count}`;
    });
    console.log(`\n📊 Category breakdown: ${categoryCounts.join(', ')}`);
    console.log(`✅ Progressive fetch complete! ${totalProcessed}/${EXPECTED_TOTAL} articles processed, ${totalSkipped} duplicates skipped across ${NEWSDATA_CATEGORIES.length} categories`);

    if (totalProcessed < EXPECTED_TOTAL) {
      console.log(`⚠️  Short by ${EXPECTED_TOTAL - totalProcessed} articles — some categories may have had limited API results`);
    }

    logger.generateDailySummary();

  } catch (error) {
    console.error('❌ Progressive fetch error:', error);
  }
}
