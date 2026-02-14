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

  // Make multiple API calls to get the desired pool size
  for (let i = 0; i < numRequests; i++) {
    const url = `https://newsdata.io/api/1/latest?` +
      `apikey=${apiKey}&` +
      `language=en&` +
      `category=${category}&` +
      `removeduplicate=1&` +
      `prioritydomain=top&` +
      `size=${maxPerRequest}`;

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

      // Stop early if we've hit the API limit (no more results)
      if (articles.length === 0) {
        console.log(`    No more articles available from API, stopping at ${allArticles.length} articles`);
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
