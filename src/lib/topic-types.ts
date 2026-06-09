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
