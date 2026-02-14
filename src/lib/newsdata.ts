/**
 * Newsdata.io API Integration
 * Fetches articles from multiple categories
 */

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
  'top',
  'breaking'
] as const;
// Full list: 'business', 'crime', 'entertainment', 'politics', 'science', 'world'

export type NewsdataCategory = typeof NEWSDATA_CATEGORIES[number];

/**
 * Fetch articles from a specific category
 */
export async function fetchCategoryArticles(
  category: NewsdataCategory,
  count: number = 5
): Promise<NewsdataArticle[]> {
  const apiKey = process.env.NEWSDATA_API_KEY;
  
  if (!apiKey) {
    throw new Error('NEWSDATA_API_KEY not configured');
  }

  const url = `https://newsdata.io/api/1/latest?` + 
    `apikey=${apiKey}&` +
    `language=en&` +
    `category=${category}&` +
    `removeduplicate=1&` +
    `prioritydomain=top&` +  // Prioritize top sources for relevancy
    `size=${count}`;

  try {
    const response = await fetch(url);
    const data: NewsdataResponse = await response.json();

    if (data.status === 'error') {
      throw new Error(`Newsdata.io API error: ${JSON.stringify(data)}`);
    }

    // Sort by recency (newest first) as secondary sort
    const articles = data.results || [];
    articles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    return articles;
  } catch (error) {
    console.error(`Error fetching ${category} articles:`, error);
    return [];
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
