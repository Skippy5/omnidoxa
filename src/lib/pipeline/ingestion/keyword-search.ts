/**
 * Keyword Search Ingestion Module
 * Ad-hoc search for articles by keywords (e.g., "US Iran bombing", "climate change")
 * 
 * Phase 1.8 - Keyword Search Ingestion
 */

import { normalizeUrl, normalizeTitle, contentHash } from '../../utils/text-processing';
import {
  updateRunStatus,
  bulkInsertStagingArticles
} from '../../db-staging';

const NEWSDATA_API_URL = 'https://newsdata.io/api/1/latest';

export interface NewsdataSearchResult {
  article_id: string;
  title: string;
  link: string;
  description: string | null;
  content: string;
  keywords: string[];
  creator: string[] | null;
  image_url: string | null;
  video_url: string | null;
  pubDate: string;
  source_name: string;
  source_icon: string | null;
  category: string[];
  country: string[];
  language: string;
}

export interface NewsdataSearchResponse {
  status: string;
  totalResults: number;
  results: NewsdataSearchResult[];
  nextPage?: string;
}

/**
 * Run keyword search ingestion
 * Searches for articles matching keywords, stages them for analysis
 * 
 * @param runId - Pipeline run ID
 * @param keywords - Search query (e.g., "US Iran bombing")
 * @param maxArticles - Maximum articles to fetch (default 10)
 * @returns Total articles staged
 */
export async function runKeywordSearch(
  runId: number,
  keywords: string,
  maxArticles: number = 10
): Promise<number> {
  console.log(`\n🔍 Starting keyword search ingestion (Run ID: ${runId})`);
  console.log(`🔑 Keywords: "${keywords}"`);
  console.log(`📊 Max articles: ${maxArticles}`);
  
  if (!keywords || keywords.trim() === '') {
    console.log(`⚠️  No keywords provided, nothing to search`);
    return 0;
  }
  
  try {
    // Update run status
    await updateRunStatus(runId, 'running', 'ingestion:keyword_search');
    
    // Fetch articles from Newsdata.io
    const articles = await searchNewsdata(keywords, maxArticles);
    
    console.log(`\n✅ Found ${articles.length} articles matching "${keywords}"`);
    
    // Handle 0 results gracefully
    if (articles.length === 0) {
      console.log(`ℹ️  No results found for "${keywords}"`);
      await updateRunStatus(runId, 'complete', 'ingestion:keyword_search');
      return 0;
    }
    
    // Stage articles (categorize as "breaking" for keyword searches)
    const staged = await stageArticles(runId, articles);
    console.log(`💾 Staged ${staged} articles`);
    
    console.log(`\n✅ Keyword search ingestion complete!`);
    
    return staged;
    
  } catch (error) {
    console.error(`\n❌ Keyword search ingestion failed:`, error);
    await updateRunStatus(runId, 'failed', 'ingestion:keyword_search', String(error));
    throw error;
  }
}

/**
 * Search Newsdata.io by keywords
 * Uses the `q` parameter for keyword search
 * 
 * @param keywords - Search query
 * @param maxArticles - Maximum articles to fetch
 * @returns Array of articles
 */
async function searchNewsdata(
  keywords: string,
  maxArticles: number
): Promise<NewsdataSearchResult[]> {
  const apiKey = process.env.NEWSDATA_API_KEY;
  
  if (!apiKey) {
    throw new Error('NEWSDATA_API_KEY not configured');
  }
  
  // Newsdata.io free tier allows max 10 articles per request
  const maxPerRequest = 10;
  const numRequests = Math.ceil(maxArticles / maxPerRequest);
  
  console.log(`\n📥 Fetching up to ${maxArticles} articles via ${numRequests} API calls...`);
  
  let allArticles: NewsdataSearchResult[] = [];
  const seenUrls = new Set<string>();
  
  for (let i = 0; i < numRequests; i++) {
    const size = Math.min(maxPerRequest, maxArticles - allArticles.length);
    
    if (size <= 0) break;
    
    const url = new URL(NEWSDATA_API_URL);
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('language', 'en');
    url.searchParams.set('q', keywords);
    url.searchParams.set('size', String(size));
    url.searchParams.set('prioritydomain', 'top');
    
    try {
      console.log(`  Request ${i + 1}/${numRequests}: Searching for "${keywords}"...`);
      
      const response = await fetch(url.toString());
      const data: NewsdataSearchResponse = await response.json();
      
      if (data.status === 'error') {
        throw new Error(`Newsdata.io API error: ${JSON.stringify(data)}`);
      }
      
      let articles = data.results || [];
      
      // Deduplicate within this batch
      articles = articles.filter(a => {
        const normUrl = normalizeUrl(a.link);
        if (seenUrls.has(normUrl)) return false;
        seenUrls.add(normUrl);
        return true;
      });
      
      allArticles.push(...articles);
      console.log(`    +${articles.length} articles (${allArticles.length} total)`);
      
      // Stop early if no more results or we hit max
      if (articles.length === 0 || allArticles.length >= maxArticles) {
        break;
      }
      
      // Rate limiting between requests (1 second)
      if (i < numRequests - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`  ❌ Request ${i + 1}/${numRequests} failed:`, error);
      break;
    }
  }
  
  // Sort by recency (newest first)
  allArticles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  
  // Return only maxArticles (trim if we got more)
  return allArticles.slice(0, maxArticles);
}

/**
 * Stage fetched articles in the database
 * Normalizes URLs, titles, and generates content hashes
 * Articles from keyword searches are categorized as "breaking"
 * 
 * @param runId - Pipeline run ID
 * @param articles - Fetched articles from Newsdata.io
 * @returns Number of articles staged
 */
async function stageArticles(
  runId: number,
  articles: NewsdataSearchResult[]
): Promise<number> {
  const stagingData = articles.map(article => {
    // Determine category: use first category from API, or "breaking" as fallback
    const category = article.category && article.category.length > 0
      ? article.category[0]
      : 'breaking';
    
    return {
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
    };
  });
  
  await bulkInsertStagingArticles(stagingData);
  return stagingData.length;
}
