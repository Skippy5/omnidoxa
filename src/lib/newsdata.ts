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
  'top', 'breaking', 'business', 'crime', 'entertainment', 'politics', 'science', 'world'
] as const;

export type NewsdataCategory = typeof NEWSDATA_CATEGORIES[number];

/**
 * Fetch articles from a specific category
 * @param category - The news category to fetch
 * @param count - Target number of articles (default 5)
 * @param excludeUrls - Set of URLs to skip (for cross-category dedup)
 */
export async function fetchCategoryArticles(
  category: NewsdataCategory,
  count: number = 5,
  excludeUrls: Set<string> = new Set()
): Promise<NewsdataArticle[]> {
  const apiKey = process.env.NEWSDATA_API_KEY;

  if (!apiKey) {
    throw new Error('NEWSDATA_API_KEY not configured');
  }

  // Request 3x articles to account for source filtering + cross-category dedup
  const fetchCount = Math.min(count * 3, 15);

  const url = `https://newsdata.io/api/1/latest?` +
    `apikey=${apiKey}&` +
    `language=en&` +
    `category=${category}&` +
    `removeduplicate=1&` +
    `prioritydomain=top&` +
    `size=${fetchCount}`;

  try {
    const response = await fetch(url);
    const data: NewsdataResponse = await response.json();

    if (data.status === 'error') {
      throw new Error(`Newsdata.io API error: ${JSON.stringify(data)}`);
    }

    let articles = data.results || [];

    // Sort by recency (newest first)
    articles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    // Filter by source quality (removes tabloids/unreliable)
    articles = filterBySourceQuality(articles);

    // Exclude URLs already seen in other categories
    if (excludeUrls.size > 0) {
      articles = articles.filter(a => !excludeUrls.has(normalizeUrl(a.link)));
    }

    // Limit to requested count
    return articles.slice(0, count);
  } catch (error) {
    console.error(`Error fetching ${category} articles:`, error);
    return [];
  }
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
