import type { Category } from './types';

export const NEWS_API_KEY = process.env.NEWS_API_KEY ?? '';
export const XAI_API_KEY = process.env.XAI_API_KEY ?? '';
export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? '';

export const REFRESH_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface CategoryConfig {
  label: string;
  color: string;
  bgColor: string;
  queries: CategoryQuery[];
}

export interface CategoryQuery {
  endpoint: 'top-headlines' | 'everything';
  params: Record<string, string>;
}

export const CATEGORIES: Record<Category, CategoryConfig> = {
  politics: {
    label: 'Politics',
    color: '#a855f7',
    bgColor: 'bg-purple-500',
    queries: [
      {
        endpoint: 'everything',
        params: { q: 'politics OR congress OR senate OR whitehouse OR democrat OR republican', language: 'en', sortBy: 'publishedAt' },
      },
    ],
  },
  crime: {
    label: 'Crime',
    color: '#ef4444',
    bgColor: 'bg-red-500',
    queries: [
      {
        endpoint: 'everything',
        params: { q: '(crime OR murder OR arrest OR robbery OR shooting) AND NOT (sports OR NBA OR NFL)', language: 'en', sortBy: 'publishedAt' },
      },
    ],
  },
  us: {
    label: 'US',
    color: '#3b82f6',
    bgColor: 'bg-blue-500',
    queries: [
      {
        endpoint: 'top-headlines',
        params: { country: 'us', category: 'general' },
      },
    ],
  },
  international: {
    label: 'International',
    color: '#22c55e',
    bgColor: 'bg-green-500',
    queries: [
      {
        endpoint: 'everything',
        params: { q: '(diplomacy OR "foreign policy" OR "united nations" OR geopolitics OR "world news") AND NOT (sports OR NBA OR NFL)', language: 'en', sortBy: 'publishedAt' },
      },
    ],
  },
  science_tech: {
    label: 'Sci/Tech',
    color: '#06b6d4',
    bgColor: 'bg-cyan-500',
    queries: [
      {
        endpoint: 'top-headlines',
        params: { country: 'us', category: 'science' },
      },
      {
        endpoint: 'top-headlines',
        params: { country: 'us', category: 'technology' },
      },
    ],
  },
  sports: {
    label: 'Sports',
    color: '#f97316',
    bgColor: 'bg-orange-500',
    queries: [
      {
        endpoint: 'top-headlines',
        params: { country: 'us', category: 'sports' },
      },
    ],
  },
  health: {
    label: 'Health',
    color: '#ec4899',
    bgColor: 'bg-pink-500',
    queries: [
      {
        endpoint: 'everything',
        params: { q: 'health OR medical OR disease OR wellness OR healthcare OR medicine', language: 'en', sortBy: 'publishedAt' },
      },
    ],
  },
  business: {
    label: 'Business',
    color: '#f59e0b',
    bgColor: 'bg-amber-500',
    queries: [
      {
        endpoint: 'top-headlines',
        params: { country: 'us', category: 'business' },
      },
    ],
  },
  entertainment: {
    label: 'Entertainment',
    color: '#f43f5e',
    bgColor: 'bg-rose-500',
    queries: [
      {
        endpoint: 'top-headlines',
        params: { country: 'us', category: 'entertainment' },
      },
    ],
  },
  environment: {
    label: 'Environment',
    color: '#14b8a6',
    bgColor: 'bg-teal-500',
    queries: [
      {
        endpoint: 'everything',
        params: { q: 'environment OR climate OR sustainability OR pollution OR conservation OR "climate change"', language: 'en', sortBy: 'publishedAt' },
      },
    ],
  },
};

export const CATEGORY_LIST: Category[] = ['politics', 'crime', 'us', 'international', 'science_tech', 'sports', 'health', 'business', 'entertainment', 'environment'];
