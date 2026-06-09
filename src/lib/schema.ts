export type DateTimeString = string;
export type JsonString = string;
export type SqliteBoolean = 0 | 1;

export type TopicStatus =
  | "draft"
  | "review"
  | "pending_publish"
  | "published"
  | "hidden"
  | "archived";

export type ArticleRole = "anchor" | "material_update" | "reference";
export type ViewpointLean = "left" | "center" | "right";
export type AnalysisProvider = "xai";
export type AnalysisReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "needs_revision";
export type SocialPostReviewStatus = "candidate" | "verified" | "rejected";
export type SubscriptionStatus =
  | "free"
  | "subscriber"
  | "past_due"
  | "canceled";

export type Topic = {
  id: string;
  title: string;
  slug: string;
  centralDevelopment: string | null;
  neutralSummary: string | null;
  discourseSummary: string | null;
  discoursePreview: string | null;
  category: string | null;
  status: TopicStatus;
  mainFeedEnabled: SqliteBoolean;
  categoryFeedEnabled: SqliteBoolean;
  isFeaturedMain: SqliteBoolean;
  featuredAt: DateTimeString | null;
  heatScore: number;
  discoverySources: JsonString | null;
  firstSeenAt: DateTimeString;
  lastUpdatedAt: DateTimeString;
  lastSentimentAt: DateTimeString | null;
  analysisVersion: number;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
};

export type TopicArticle = {
  id: string;
  topicId: string | null;
  articleRole: ArticleRole;
  title: string;
  url: string;
  urlHash: string;
  source: string;
  sourceTier: number;
  snippet: string | null;
  imageUrl: string | null;
  author: string | null;
  publishedAt: DateTimeString | null;
  fetchedAt: DateTimeString;
  isMaterialUpdate: SqliteBoolean;
  narrativeBiasScore: number | null;
  narrativeBiasLabel: string | null;
  narrativeBiasReasoning: string | null;
  createdAt: DateTimeString;
};

export type TopicAnalysisRun = {
  id: string;
  topicId: string;
  analysisVersion: number;
  provider: AnalysisProvider;
  model: string;
  rawResponseJson: JsonString;
  reviewStatus: AnalysisReviewStatus;
  reviewedBy: string | null;
  reviewedAt: DateTimeString | null;
  createdAt: DateTimeString;
};

export type TopicViewpoint = {
  id: string;
  topicId: string;
  lean: ViewpointLean;
  label: string | null;
  summary: string;
  originalSummary: string | null;
  sentimentScore: number | null;
  analysisVersion: number;
  createdAt: DateTimeString;
};

export type TopicSocialPost = {
  id: string;
  topicId: string;
  viewpointLean: ViewpointLean;
  author: string | null;
  authorHandle: string | null;
  text: string;
  url: string;
  platform: string;
  likes: number;
  retweets: number;
  reviewStatus: SocialPostReviewStatus;
  isVerified: SqliteBoolean;
  postDate: DateTimeString | null;
  analysisVersion: number;
  createdAt: DateTimeString;
};

export type TopicUpdate = {
  id: string;
  topicId: string;
  updateType: string;
  description: string | null;
  source: string | null;
  detectedAt: DateTimeString;
};

export type Member = {
  id: string;
  clerkUserId: string;
  email: string;
  subscriptionStatus: SubscriptionStatus;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
};

export type AdminGrant = {
  id: string;
  memberId: string;
  grantedBy: string | null;
  grantedAt: DateTimeString;
  revokedAt: DateTimeString | null;
};

export type BriefingPreference = {
  id: string;
  memberId: string;
  location: string | null;
  stockTickers: JsonString | null;
  newsCategories: JsonString | null;
  deliveryTime: string | null;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
};

export type DatabaseEntityMap = {
  topics: Topic;
  topic_articles: TopicArticle;
  topic_analysis_runs: TopicAnalysisRun;
  topic_viewpoints: TopicViewpoint;
  topic_social_posts: TopicSocialPost;
  topic_updates: TopicUpdate;
  members: Member;
  admin_grants: AdminGrant;
  briefing_preferences: BriefingPreference;
};
