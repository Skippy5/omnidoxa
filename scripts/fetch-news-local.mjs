#!/usr/bin/env node
/**
 * Local News Aggregation Script
 * Runs the OmniDoxa news fetch+analysis pipeline locally (no Vercel timeout limits)
 * 
 * Usage:
 *   node scripts/fetch-news-local.mjs              # Fetch all categories
 *   node scripts/fetch-news-local.mjs politics     # Fetch single category
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
config({ path: join(projectRoot, '.env.local') });

// Import OmniDoxa modules
const {
  fetchCategoryArticles,
  saveCachedArticles,
  getCachedArticles,
  normalizeUrl,
  NEWSDATA_CATEGORIES,
} = await import('../src/lib/newsdata.js');

const { FetchLogger } = await import('../src/lib/fetch-logger.js');
const { convertToStoryWithTwitterPipeline } = await import('../src/lib/convert-with-twitter-pipeline.js');
const { saveStoryWithViewpoints, clearCategoryArticles } = await import('../src/lib/db-cloud.js');

const ARTICLES_PER_CATEGORY = 5;

/**
 * Normalize a title for deduplication (lowercase, strip punctuation/whitespace)
 */
function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Check if an article is a duplicate by URL or title
 */
function isDuplicate(article, seenUrls, seenTitles) {
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
function markSeen(article, seenUrls, seenTitles) {
  seenUrls.add(normalizeUrl(article.link));
  seenTitles.add(normalizeTitle(article.title));
}

/**
 * Main fetch and analysis pipeline (extracted from Vercel API route)
 */
async function runNewsFetch(categoryFilter) {
  const logger = new FetchLogger();
  
  // Apply category filter (optional)
  const categoriesToProcess = categoryFilter 
    ? NEWSDATA_CATEGORIES.filter(c => c === categoryFilter)
    : NEWSDATA_CATEGORIES;
  
  const expectedTotal = ARTICLES_PER_CATEGORY * categoriesToProcess.length;
  
  console.log(`🚀 Starting news fetch (${categoriesToProcess.length} categories, ${ARTICLES_PER_CATEGORY} articles each, ${expectedTotal} total)...`);
  console.log(`📋 Categories: ${categoriesToProcess.map(c => c.toUpperCase()).join(', ')}`);
  console.log(`🕐 Started at: ${new Date().toLocaleString()}\n`);

  // Global dedup sets — shared across all categories
  const seenUrls = new Set();
  const seenTitles = new Set();

  const allArticles = {};
  let totalProcessed = 0;
  let totalSkipped = 0;

  // Process each category sequentially
  for (let catIndex = 0; catIndex < categoriesToProcess.length; catIndex++) {
    const category = categoriesToProcess[catIndex];

    console.log(`\n📰 [${catIndex + 1}/${categoriesToProcess.length}] Processing category: ${category.toUpperCase()}`);
    logger.logFetchStart(category);

    try {
      // Step 1: Fetch 50 articles, then deduplicate down to 5
      console.log(`  ⬇️  Fetching pool of 50 articles from ${category} (dedup → ${ARTICLES_PER_CATEGORY})...`);
      const articles = await fetchCategoryArticles(category, ARTICLES_PER_CATEGORY, seenUrls, 50);

      // Step 2: Apply title + URL dedup against global seen sets
      const uniqueArticles = [];
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

      // Step 3: Clear old articles for this category before saving new ones
      const clearedCount = await clearCategoryArticles(category);
      if (clearedCount > 0) {
        console.log(`  🗑️  Cleared ${clearedCount} old ${category} articles`);
      }

      // Step 4: Analyze and save each article immediately
      logger.logAnalysisStart(category);

      for (let i = 0; i < uniqueArticles.length; i++) {
        try {
          console.log(`  📊 [${i + 1}/${uniqueArticles.length}] Analyzing: ${uniqueArticles[i].title.substring(0, 60)}...`);

          const story = await convertToStoryWithTwitterPipeline(uniqueArticles[i], totalProcessed + i + 1, category);

          await saveStoryWithViewpoints(story);

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
      await saveCachedArticles(allArticles);
      console.log(`  💾 Cache updated (${totalProcessed}/${expectedTotal} articles total)`);

      // Pause between categories (5 seconds)
      if (catIndex < categoriesToProcess.length - 1) {
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

  // Final summary
  const categoryCounts = categoriesToProcess.map(cat => {
    const count = (allArticles[cat] || []).length;
    return `${cat}: ${count}`;
  });
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 FINAL SUMMARY`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 Category breakdown: ${categoryCounts.join(', ')}`);
  console.log(`✅ Articles processed: ${totalProcessed}/${expectedTotal}`);
  console.log(`⏭️  Duplicates skipped: ${totalSkipped}`);
  console.log(`🕐 Completed at: ${new Date().toLocaleString()}`);

  if (totalProcessed < expectedTotal) {
    console.log(`⚠️  Short by ${expectedTotal - totalProcessed} articles — some categories may have had limited API results`);
  }

  logger.generateDailySummary();
  
  return {
    success: true,
    articlesProcessed: totalProcessed,
    articlesExpected: expectedTotal,
    duplicatesSkipped: totalSkipped,
    categories: categoriesToProcess.length
  };
}

// CLI entry point
const categoryFilter = process.argv[2]; // Optional: node fetch-news-local.mjs politics

runNewsFetch(categoryFilter)
  .then(result => {
    console.log('\n✅ News fetch completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ News fetch failed:', error);
    process.exit(1);
  });
