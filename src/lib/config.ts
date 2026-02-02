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
};

export const CATEGORY_LIST: Category[] = ['politics', 'crime', 'us', 'international', 'science_tech'];
