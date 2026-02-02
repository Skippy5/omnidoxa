import { NEWS_API_KEY, CATEGORIES, CATEGORY_LIST } from './config';
import type { Category, NewsAPIResponse, Story } from './types';

const BASE_URL = 'https://newsapi.org/v2';
const STORIES_PER_CATEGORY = 2;

async function fetchFromNewsAPI(
  endpoint: 'top-headlines' | 'everything',
  params: Record<string, string>
): Promise<NewsAPIResponse> {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set('apiKey', NEWS_API_KEY);
  url.searchParams.set('pageSize', '5');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'OmniDoxa/1.0' },
  });

  if (res.status === 429) {
    throw new Error('NewsAPI rate limit exceeded. Please try again later.');
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`NewsAPI error ${res.status}: ${body}`);
  }

  return res.json();
}

export async function fetchStoriesForCategory(
  category: Category
): Promise<Omit<Story, 'id' | 'created_at'>[]> {
  const config = CATEGORIES[category];
  const now = new Date().toISOString();
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const stories: Omit<Story, 'id' | 'created_at'>[] = [];

  for (const query of config.queries) {
    if (stories.length >= STORIES_PER_CATEGORY) break;

    try {
      const response = await fetchFromNewsAPI(query.endpoint, query.params);

      for (const article of response.articles) {
        if (stories.length >= STORIES_PER_CATEGORY) break;
        if (!article.title || article.title === '[Removed]') continue;
        if (seenUrls.has(article.url)) continue;
        // Also dedup by title (some articles appear from multiple sources)
        const normalizedTitle = article.title.toLowerCase().replace(/\s+/g, ' ').trim();
        if (seenTitles.has(normalizedTitle)) continue;
        seenUrls.add(article.url);
        seenTitles.add(normalizedTitle);

        stories.push({
          title: article.title,
          description: article.description,
          url: article.url,
          source: article.source.name,
          image_url: article.urlToImage,
          category,
          published_at: article.publishedAt,
          fetched_at: now,
        });
      }
    } catch (error) {
      console.error(`Error fetching ${category} from ${query.endpoint}:`, error);
    }
  }

  return stories;
}

export async function fetchAllStories(): Promise<Omit<Story, 'id' | 'created_at'>[]> {
  if (!NEWS_API_KEY) {
    throw new Error('NEWS_API_KEY is not configured');
  }

  const allStories: Omit<Story, 'id' | 'created_at'>[] = [];
  const globalSeenUrls = new Set<string>();

  for (const category of CATEGORY_LIST) {
    const stories = await fetchStoriesForCategory(category);

    for (const story of stories) {
      if (!globalSeenUrls.has(story.url)) {
        globalSeenUrls.add(story.url);
        allStories.push(story);
      }
    }
  }

  return allStories;
}
