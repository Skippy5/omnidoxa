/**
 * API Route: Fetch news articles from Newsdata.io
 * GET /api/news/fetch - Fetch and analyze categories one at a time for progressive display
 */

import { NextResponse } from 'next/server';
import {
  fetchCategoryArticles,
  saveCachedArticles,
  getCachedArticles,
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
 * Fetch and analyze categories one at a time for progressive display
 * This allows the UI to show articles as they become available
 */
async function triggerProgressiveFetchAndAnalysis(): Promise<void> {
  const logger = new FetchLogger();
  console.log('🚀 Starting progressive category processing...');
  
  try {
    const { convertToStoryWithGrok4Direct } = await import('@/lib/grok4-sentiment-direct');
    const { saveStoryWithViewpoints } = await import('@/lib/db');
    
    const allArticles: Record<string, NewsdataArticle[]> = {};
    let totalProcessed = 0;
    
    // Process each category sequentially
    for (let catIndex = 0; catIndex < NEWSDATA_CATEGORIES.length; catIndex++) {
      const category = NEWSDATA_CATEGORIES[catIndex];
      
      console.log(`\n📰 [${catIndex + 1}/${NEWSDATA_CATEGORIES.length}] Processing category: ${category.toUpperCase()}`);
      logger.logFetchStart(category);
      
      try {
        // Step 1: Fetch articles for this category
        console.log(`  ⬇️  Fetching 5 articles from ${category}...`);
        const articles = await fetchCategoryArticles(category, 5);
        allArticles[category] = articles;
        
        console.log(`  ✅ Fetched ${articles.length} ${category} articles`);
        logger.logFetchComplete(category, articles.length);
        
        // Step 2: Analyze and save each article immediately
        logger.logAnalysisStart(category);
        
        for (let i = 0; i < articles.length; i++) {
          try {
            console.log(`  📊 [${i + 1}/5] Analyzing: ${articles[i].title.substring(0, 60)}...`);
            
            // Analyze with Grok-4 using /v1/responses API with x_search
            const story = await convertToStoryWithGrok4Direct(articles[i], totalProcessed + i + 1, category);
            
            // Save to database immediately
            saveStoryWithViewpoints(story);
            
            const tweetCount = story.viewpoints.reduce((sum, vp) => sum + vp.social_posts.length, 0);
            console.log(`  ✅ [${i + 1}/5] Saved with ${tweetCount} tweets`);
            
            logger.logArticleAnalyzed(category, i + 1, articles[i].title, tweetCount);
            
            // Rate limiting: 2 seconds between articles
            if (i < articles.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`  ❌ Failed to analyze article ${i + 1}:`, errorMsg);
            logger.logError(category, `Article ${i + 1} analysis failed: ${errorMsg}`);
          }
        }
        
        logger.logAnalysisComplete(category);
        totalProcessed += articles.length;
        
        // Step 3: Update cache after each category completes
        await saveCachedArticles(allArticles as any);
        console.log(`  💾 Cache updated (${totalProcessed} articles total)`);
        
        // Pause between categories (5 seconds)
        if (catIndex < NEWSDATA_CATEGORIES.length - 1) {
          console.log(`  ⏸️  Pausing 5s before next category...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ Failed to process ${category} category:`, errorMsg);
        logger.logError(category, `Category fetch failed: ${errorMsg}`);
        // Continue to next category even if this one fails
        allArticles[category] = [];
      }
    }
    
    console.log(`\n✅ Progressive fetch complete! Processed ${totalProcessed} articles across ${NEWSDATA_CATEGORIES.length} categories`);
    
    // Generate daily summary log
    logger.generateDailySummary();
    
  } catch (error) {
    console.error('❌ Progressive fetch error:', error);
  }
}
