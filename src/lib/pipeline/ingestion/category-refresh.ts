/**
 * Category Refresh Ingestion Module
 * Fetches articles from specific categories (50 articles each)
 * 
 * Phase 1.7 - Category Refresh Ingestion
 */

import { fetchCategoryArticles, type NewsdataArticle, type NewsdataCategory } from '../../newsdata';
import { normalizeUrl, normalizeTitle, contentHash } from '../../utils/text-processing';
import {
  updateRunStatus,
  initCategoryStatus,
  updateCategoryStatus,
  bulkInsertStagingArticles
} from '../../db-staging';

const DELAY_BETWEEN_CATEGORIES = 5000; // 5 seconds
const ARTICLES_PER_CATEGORY = 50;

/**
 * Run category refresh ingestion
 * Fetches specific categories (50 articles each) with 5-second delays
 * 
 * @param runId - Pipeline run ID
 * @param categories - Array of categories to refresh
 * @returns Total articles staged
 */
export async function runCategoryRefresh(
  runId: number,
  categories: NewsdataCategory[]
): Promise<number> {
  console.log(`\n🔄 Starting category refresh ingestion (Run ID: ${runId})`);
  console.log(`📋 Categories: ${categories.join(', ')}`);
  console.log(`📊 Target: ${ARTICLES_PER_CATEGORY} articles per category`);
  
  if (categories.length === 0) {
    console.log(`⚠️  No categories specified, nothing to refresh`);
    return 0;
  }
  
  let totalArticles = 0;
  
  try {
    // Update run status
    await updateRunStatus(runId, 'running', 'ingestion:category_refresh');
    
    // Initialize category status
    await initCategoryStatus(runId, categories, ARTICLES_PER_CATEGORY);
    console.log(`✅ Initialized status tracking for ${categories.length} categories\n`);
    
    // Fetch each category sequentially with delay
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const categoryNum = i + 1;
      
      console.log(`\n[${categoryNum}/${categories.length}] 📰 Fetching: ${category.toUpperCase()}`);
      
      try {
        // Update category status to 'fetching'
        await updateCategoryStatus(runId, category, {
          status: 'fetching',
          pull_attempts: 1
        });
        
        // Fetch articles from Newsdata.io
        const articles = await fetchCategoryArticles(
          category,
          ARTICLES_PER_CATEGORY,
          new Set(), // No exclusions for category refresh
          ARTICLES_PER_CATEGORY
        );
        
        console.log(`  ✅ Fetched ${articles.length} articles`);
        
        // Stage articles
        if (articles.length > 0) {
          const staged = await stageArticles(runId, category, articles);
          totalArticles += staged;
          
          // Update category status
          await updateCategoryStatus(runId, category, {
            current_count: staged,
            status: 'ready'
          });
          
          console.log(`  💾 Staged ${staged} articles`);
        } else {
          console.log(`  ⚠️  No articles available for ${category}`);
          await updateCategoryStatus(runId, category, {
            current_count: 0,
            status: 'complete'
          });
        }
        
      } catch (error) {
        console.error(`  ❌ Failed to fetch ${category}:`, error);
        
        // Update category status to 'failed' but continue with other categories
        await updateCategoryStatus(runId, category, {
          status: 'failed'
        });
        
        // Log error but don't throw (graceful failure handling)
        console.log(`  ⏭️  Skipping ${category}, continuing with remaining categories...`);
      }
      
      // Delay between categories (except after the last one)
      if (i < categories.length - 1) {
        console.log(`  ⏸️  Waiting ${DELAY_BETWEEN_CATEGORIES / 1000}s before next category...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CATEGORIES));
      }
    }
    
    console.log(`\n✅ Category refresh ingestion complete!`);
    console.log(`📊 Total articles staged: ${totalArticles}`);
    
    return totalArticles;
    
  } catch (error) {
    console.error(`\n❌ Category refresh ingestion failed:`, error);
    await updateRunStatus(runId, 'failed', 'ingestion:category_refresh', String(error));
    throw error;
  }
}

/**
 * Stage fetched articles in the database
 * Normalizes URLs, titles, and generates content hashes
 * 
 * @param runId - Pipeline run ID
 * @param category - Article category
 * @param articles - Fetched articles from Newsdata.io
 * @returns Number of articles staged
 */
async function stageArticles(
  runId: number,
  category: string,
  articles: NewsdataArticle[]
): Promise<number> {
  const stagingData = articles.map(article => ({
    run_id: runId,
    category,
    title: article.title,
    title_normalized: normalizeTitle(article.title),
    description: article.description || null,
    url: article.link,
    url_normalized: normalizeUrl(article.link),
    content_hash: contentHash(article.title, article.description),
    source: article.source_name,
    image_url: article.image_url || null,
    published_at: article.pubDate,
    pull_batch: 1,
    status: 'staged' as const,
    rejection_reason: null
  }));
  
  await bulkInsertStagingArticles(stagingData);
  return stagingData.length;
}
