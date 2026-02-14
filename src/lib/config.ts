import type { Category } from './types';

export const NEWS_API_KEY = process.env.NEWS_API_KEY ?? '';
export const XAI_API_KEY = process.env.XAI_API_KEY ?? '';
export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? '';
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

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
  breaking: {
    label: 'Breaking',
    color: '#ef4444',
    bgColor: 'bg-red-500',
    queries: [{ endpoint: 'everything', params: { q: 'breaking news', language: 'en', sortBy: 'publishedAt' } }],
  },
  business: {
    label: 'Business',
    color: '#f59e0b',
    bgColor: 'bg-amber-500',
    queries: [{ endpoint: 'top-headlines', params: { country: 'us', category: 'business' } }],
  },
  crime: {
    label: 'Crime',
    color: '#dc2626',
    bgColor: 'bg-red-600',
    queries: [{ endpoint: 'everything', params: { q: 'crime', language: 'en', sortBy: 'publishedAt' } }],
  },
  entertainment: {
    label: 'Entertainment',
    color: '#f43f5e',
    bgColor: 'bg-rose-500',
    queries: [{ endpoint: 'top-headlines', params: { country: 'us', category: 'entertainment' } }],
  },
  politics: {
    label: 'Politics',
    color: '#a855f7',
    bgColor: 'bg-purple-500',
    queries: [{ endpoint: 'everything', params: { q: 'politics', language: 'en', sortBy: 'publishedAt' } }],
  },
  science: {
    label: 'Science',
    color: '#06b6d4',
    bgColor: 'bg-cyan-500',
    queries: [{ endpoint: 'top-headlines', params: { country: 'us', category: 'science' } }],
  },
  top: {
    label: 'Top Stories',
    color: '#8b5cf6',
    bgColor: 'bg-violet-500',
    queries: [{ endpoint: 'top-headlines', params: { country: 'us' } }],
  },
  world: {
    label: 'World',
    color: '#22c55e',
    bgColor: 'bg-green-500',
    queries: [{ endpoint: 'everything', params: { q: 'world news', language: 'en', sortBy: 'publishedAt' } }],
  },
};

export const CATEGORY_LIST: Category[] = ['breaking', 'business', 'crime', 'entertainment', 'politics', 'science', 'top', 'world'];
