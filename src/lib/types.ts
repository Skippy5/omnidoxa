export type Category = 'top' | 'breaking' | 'technology' | 'domestic' | 'business' | 'crime' | 'entertainment' | 'politics' | 'science' | 'world';

export type Lean = 'left' | 'center' | 'right';

export interface Story {
  id: number;
  title: string;
  description: string | null;
  url: string;
  source: string;
  image_url: string | null;
  category: Category;
  published_at: string;
  fetched_at: string;
  created_at: string;
}

export interface Viewpoint {
  id: number;
  story_id: number;
  lean: Lean;
  summary: string;
  sentiment_score: number; // -1 (negative) to 0 (neutral) to +1 (positive)
  availability_note?: string;
  created_at: string;
}

export interface SocialPost {
  id: number;
  viewpoint_id: number;
  author: string;
  author_handle: string;
  text: string;
  url: string;
  platform: string;
  likes: number;
  retweets: number;
  /**
   * true  → fetched from a real source (xAI x_search, Reddit API, etc.)
   * false → synthetic/keyword-generated fallback
   */
  is_real: boolean;
  /**
   * ISO-8601 timestamp from the originating platform, or null for synthetic posts.
   * Example: "2026-02-19T14:30:00Z"
   */
  post_date: string | null;
  created_at: string;
}

export interface StoryWithViewpoints extends Story {
  viewpoints: ViewpointWithPosts[];
}

export interface ViewpointWithPosts extends Viewpoint {
  social_posts: SocialPost[];
}

export interface NewsAPIArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

export interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
}
