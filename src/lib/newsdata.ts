/**
 * Newsdata.io API Integration
 * Fetches articles from multiple categories
 */

import { filterBySourceQuality } from './source-filter';

export interface NewsdataArticle {
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
  sentiment?: {
    score: number; // -1 to 1
    label: 'positive' | 'negative' | 'neutral';
    confidence: number;
  };
}

export interface NewsdataResponse {
  status: string;
  totalResults: number;
  results: NewsdataArticle[];
  nextPage?: string;
}

export const NEWSDATA_CATEGORIES = [
  'top', 'breaking', 'technology', 'domestic', 'business', 'crime', 'entertainment', 'politics', 'science', 'world'
] as const;

export type NewsdataCategory = typeof NEWSDATA_CATEGORIES[number];

/**
 * Filter out non-English articles
 * Detects articles with non-Latin characters (Chinese, Japanese, Korean, Arabic, etc.)
 */
function filterNonEnglish(articles: NewsdataArticle[]): NewsdataArticle[] {
  return articles.filter(article => {
    const title = article.title || '';
    const description = article.description || '';
    
    // Check for non-Latin scripts (CJK, Arabic, Cyrillic, etc.)
    // Allow common punctuation, numbers, and extended Latin (accents)
    const nonLatinPattern = /[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0C00-\u0C7F\u0D00-\u0D7F\u0E00-\u0E7F\u0F00-\u0FFF\u1000-\u109F\u10A0-\u10FF\u1100-\u11FF\u1200-\u137F\u13A0-\u13FF\u1400-\u167F\u1680-\u169F\u16A0-\u16FF\u1700-\u171F\u1720-\u173F\u1740-\u175F\u1760-\u177F\u1780-\u17FF\u1800-\u18AF\u1900-\u194F\u1950-\u197F\u1980-\u19DF\u19E0-\u19FF\u1A00-\u1A1F\u1A20-\u1AAF\u1B00-\u1B7F\u1B80-\u1BBF\u1BC0-\u1BFF\u1C00-\u1C4F\u1C50-\u1C7F\u1CC0-\u1CCF\u1CD0-\u1CFF\u1D00-\u1D7F\u1D80-\u1DBF\u1DC0-\u1DFF\u1E00-\u1EFF\u1F00-\u1FFF\u2C00-\u2C5F\u2C60-\u2C7F\u2C80-\u2CFF\u2D00-\u2D2F\u2D30-\u2D7F\u2D80-\u2DDF\u2DE0-\u2DFF\u2E00-\u2E7F\u2E80-\u2EFF\u2F00-\u2FDF\u2FF0-\u2FFF\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3130-\u318F\u3190-\u319F\u31A0-\u31BF\u31C0-\u31EF\u31F0-\u31FF\u3200-\u32FF\u3300-\u33FF\u3400-\u4DBF\u4DC0-\u4DFF\u4E00-\u9FFF\uA000-\uA48F\uA490-\uA4CF\uA4D0-\uA4FF\uA500-\uA63F\uA640-\uA69F\uA6A0-\uA6FF\uA700-\uA71F\uA720-\uA7FF\uA800-\uA82F\uA830-\uA83F\uA840-\uA87F\uA880-\uA8DF\uA8E0-\uA8FF\uA900-\uA92F\uA930-\uA95F\uA960-\uA97F\uA980-\uA9DF\uA9E0-\uA9FF\uAA00-\uAA5F\uAA60-\uAA7F\uAA80-\uAADF\uAAE0-\uAAFF\uAB00-\uAB2F\uAB30-\uAB6F\uAB70-\uABBF\uABC0-\uABFF\uAC00-\uD7AF\uD7B0-\uD7FF\uF900-\uFAFF\uFB00-\uFB4F\uFB50-\uFDFF\uFE00-\uFE0F\uFE10-\uFE1F\uFE20-\uFE2F\uFE30-\uFE4F\uFE50-\uFE6F\uFE70-\uFEFF\uFF00-\uFFEF]/;
    
    // If title or first 100 chars of description contain non-Latin characters, filter it out
    const textToCheck = title + ' ' + description.substring(0, 100);
    
    if (nonLatinPattern.test(textToCheck)) {
      console.log(`  🚫 Filtered non-English: "${title.substring(0, 50)}..."`);
      return false;
    }
    
    return true;
  });
}

/**
 * Fetch articles from a specific category
 * @param category - The news category to fetch
 * @param count - Target number of articles (default 5)
 * @param excludeUrls - Set of URLs to skip (for cross-category dedup)
 * @param fetchPoolSize - How many articles to fetch before dedup (default 50)
 */
export async function fetchCategoryArticles(
  category: NewsdataCategory,
  count: number = 5,
  excludeUrls: Set<string> = new Set(),
  fetchPoolSize: number = 50
): Promise<NewsdataArticle[]> {
  const apiKey = process.env.NEWSDATA_API_KEY;

  if (!apiKey) {
    throw new Error('NEWSDATA_API_KEY not configured');
  }

  // Newsdata.io free tier allows max 10 articles per request
  const maxPerRequest = 10;
  const numRequests = Math.ceil(fetchPoolSize / maxPerRequest);
  
  console.log(`  📥 Fetching ${fetchPoolSize} articles via ${numRequests} API calls (${maxPerRequest} each)...`);

  let allArticles: NewsdataArticle[] = [];
  const seenUrls = new Set<string>();
  let nextPage: string | null = null;

  // Make multiple API calls with pagination to get the desired pool size
  for (let i = 0; i < numRequests; i++) {
    // Build URL with pagination support
    let url: string;
    if (nextPage) {
      // Use nextPage token for subsequent requests
      url = `https://newsdata.io/api/1/latest?` +
        `apikey=${apiKey}&` +
        `page=${nextPage}`;
    } else {
      // First request with full parameters
      url = `https://newsdata.io/api/1/latest?` +
        `apikey=${apiKey}&` +
        `language=en&` +
        `category=${category}&` +
        `removeduplicate=1&` +
        `prioritydomain=top&` +
        `size=${maxPerRequest}`;
    }

    try {
      const response = await fetch(url);
      const data: NewsdataResponse = await response.json();

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
      console.log(`    Request ${i + 1}/${numRequests}: +${articles.length} articles (${allArticles.length} total so far)`);

      // Update nextPage token for pagination
      nextPage = data.nextPage || null;

      // Stop early if no more pages available
      if (!nextPage) {
        console.log(`    No more pages available from API, stopping at ${allArticles.length} articles`);
        break;
      }

      // Stop if we've got enough articles
      if (allArticles.length >= fetchPoolSize) {
        console.log(`    Reached target pool size (${fetchPoolSize}), stopping at ${allArticles.length} articles`);
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

  // Filter by source quality (removes tabloids/unreliable)
  allArticles = filterBySourceQuality(allArticles);

  // Filter non-English articles
  const beforeLangFilter = allArticles.length;
  allArticles = filterNonEnglish(allArticles);
  const langFiltered = beforeLangFilter - allArticles.length;
  if (langFiltered > 0) {
    console.log(`  🌐 Filtered out ${langFiltered} non-English articles`);
  }

  // Exclude URLs already seen in other categories
  if (excludeUrls.size > 0) {
    allArticles = allArticles.filter(a => !excludeUrls.has(normalizeUrl(a.link)));
  }

  console.log(`  ✅ Final pool: ${allArticles.length} unique articles after filtering`);

  // Return requested count (top N by recency)
  return allArticles.slice(0, count);
}

/**
 * Normalize a URL for deduplication (strip tracking params, trailing slashes)
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove common tracking parameters
    for (const param of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'fbclid', 'gclid']) {
      parsed.searchParams.delete(param);
    }
    // Normalize: lowercase host, remove trailing slash, sort remaining params
    parsed.searchParams.sort();
    const path = parsed.pathname.replace(/\/+$/, '');
    const search = parsed.searchParams.toString();
    return `${parsed.hostname.toLowerCase()}${path}${search ? '?' + search : ''}`;
  } catch {
    return url.toLowerCase().trim();
  }
}

/**
 * Fetch articles from all categories
 */
export async function fetchAllCategories(
  articlesPerCategory: number = 5
): Promise<Record<NewsdataCategory, NewsdataArticle[]>> {
  const results: Partial<Record<NewsdataCategory, NewsdataArticle[]>> = {};

  // Fetch all categories in parallel
  await Promise.all(
    NEWSDATA_CATEGORIES.map(async (category) => {
      const articles = await fetchCategoryArticles(category, articlesPerCategory);
      results[category] = articles;
    })
  );

  return results as Record<NewsdataCategory, NewsdataArticle[]>;
}

/**
 * Get cached articles from filesystem
 */
export async function getCachedArticles(): Promise<{
  lastUpdated: string;
  articles: Record<NewsdataCategory, NewsdataArticle[]>;
} | null> {
  const fs = require('fs');
  const path = require('path');
  const cacheFile = path.join(process.cwd(), 'news-cache.json');

  try {
    if (!fs.existsSync(cacheFile)) {
      return null;
    }

    const content = fs.readFileSync(cacheFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading news cache:', error);
    return null;
  }
}

/**
 * Save articles to cache
 */
export async function saveCachedArticles(
  articles: Record<NewsdataCategory, NewsdataArticle[]>
): Promise<void> {
  const fs = require('fs');
  const path = require('path');
  const cacheFile = path.join(process.cwd(), 'news-cache.json');

  const cacheData = {
    lastUpdated: new Date().toISOString(),
    articles
  };

  fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
}
