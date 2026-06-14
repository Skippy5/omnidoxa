export type PoliticalLean = "Left" | "Center" | "Right";

export type SentimentSnapshot = {
  lean: PoliticalLean;
  score: number;
  label: string;
  summary: string;
  evidenceCount: number;
};

export type LockedSocialPostPreview = {
  lean: PoliticalLean;
  platform: string;
  sourceLabel: string;
  evidenceCount: number;
};

export type PremiumSocialPost = {
  id: string;
  lean: PoliticalLean;
  author: string | null;
  authorHandle: string | null;
  text: string;
  url: string;
  platform: string;
  likes: number;
  retweets: number;
  postDate: string | null;
};

export type PremiumViewpoint = {
  lean: PoliticalLean;
  label: string | null;
  summary: string;
  sentimentScore: number | null;
  posts: PremiumSocialPost[];
};

export type PremiumAnalysis = {
  analysisVersion: number;
  viewpoints: PremiumViewpoint[];
};

export type PublicTopic = {
  id: string;
  slug: string;
  category: string;
  title: string;
  kicker: string;
  updatedAt: string;
  readTime: string;
  heatScore: number;
  image: string;
  imageAlt: string;
  heroImage?: string;
  heroImageAlt?: string;
  centralDevelopment: string;
  neutralSummary: string;
  discoursePreview: string;
  anchorArticle: {
    title: string;
    source: string;
    url: string;
  };
  sentiment: SentimentSnapshot[];
  lockedSocialPosts: LockedSocialPostPreview[];
  premiumAnalysis: PremiumAnalysis | null;
};

export const newsCategories = [
  "Politics",
  "U.S.",
  "World",
  "Business",
  "Tech & AI",
  "Science & Health",
  "Entertainment",
];

export function getCategoryHref(category: string) {
  return `/?category=${encodeURIComponent(category)}#topics`;
}
