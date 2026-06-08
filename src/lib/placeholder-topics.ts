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

export type PlaceholderTopic = {
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

export const placeholderTopics: PlaceholderTopic[] = [
  {
    id: "topic-001",
    slug: "senate-energy-permitting-bill",
    category: "Politics",
    title: "Senate negotiators advance a narrower energy permitting bill",
    kicker: "Capitol Hill",
    updatedAt: "Updated 2h ago",
    readTime: "7 min read",
    heatScore: 82,
    image: "/editorial/politics.png",
    imageAlt: "Monochrome editorial image of a capitol building",
    heroImage: "/editorial/lead-analysis.png",
    heroImageAlt: "Abstract blue half-sphere surrounded by a dotted analytic ring",
    centralDevelopment:
      "A bipartisan Senate group released a trimmed permitting proposal after removing several transmission and fossil-fuel provisions.",
    neutralSummary:
      "The proposal would shorten some federal review timelines while leaving larger fights over transmission planning and drilling authority unresolved.",
    discoursePreview:
      "Left-leaning discussion is focused on environmental review limits, Center commentary is weighing whether a smaller deal can pass, and Right-leaning voices are criticizing the bill as too limited.",
    anchorArticle: {
      title: "Senators release revised permitting framework",
      source: "Placeholder Wire",
      url: "https://example.com/anchor/senate-energy-permitting-bill",
    },
    sentiment: [
      {
        lean: "Left",
        score: -0.58,
        label: "Critical",
        summary: "Concern centers on review shortcuts and local input.",
        evidenceCount: 2,
      },
      {
        lean: "Center",
        score: 0.12,
        label: "Cautious",
        summary: "Process and vote-count viability dominate the discussion.",
        evidenceCount: 2,
      },
      {
        lean: "Right",
        score: -0.28,
        label: "Skeptical",
        summary: "Criticism frames the compromise as underpowered.",
        evidenceCount: 2,
      },
    ],
    lockedSocialPosts: [
      {
        lean: "Left",
        platform: "X",
        sourceLabel: "Verified policy commentator",
        evidenceCount: 2,
      },
      {
        lean: "Center",
        platform: "X",
        sourceLabel: "Verified congressional reporter",
        evidenceCount: 2,
      },
      {
        lean: "Right",
        platform: "X",
        sourceLabel: "Verified energy analyst",
        evidenceCount: 2,
      },
    ],
  },
  {
    id: "topic-002",
    slug: "ai-chip-export-review",
    category: "Tech & AI",
    title: "Commerce officials open a review of advanced AI chip exports",
    kicker: "Technology Policy",
    updatedAt: "Updated 4h ago",
    readTime: "6 min read",
    heatScore: 74,
    image: "/editorial/technology.png",
    imageAlt: "Monochrome editorial portrait representing artificial intelligence",
    centralDevelopment:
      "Commerce officials began a new review of advanced AI accelerator export licenses after industry groups requested clearer country-by-country guidance.",
    neutralSummary:
      "The review could alter how chipmakers seek export approval, but officials have not announced new country tiers or licensing thresholds.",
    discoursePreview:
      "Left and Center discussion is split between security concerns and market stability, while Right-leaning commentary is emphasizing domestic competitiveness.",
    anchorArticle: {
      title: "Commerce begins AI accelerator license review",
      source: "Placeholder Tech Desk",
      url: "https://example.com/anchor/ai-chip-export-review",
    },
    sentiment: [
      {
        lean: "Left",
        score: 0.18,
        label: "Guarded",
        summary: "Support depends on labor, safety, and allied coordination.",
        evidenceCount: 2,
      },
      {
        lean: "Center",
        score: 0.36,
        label: "Measured",
        summary: "Commentary stresses predictability for firms and allies.",
        evidenceCount: 2,
      },
      {
        lean: "Right",
        score: -0.16,
        label: "Wary",
        summary: "Pushback focuses on slowing domestic manufacturers.",
        evidenceCount: 2,
      },
    ],
    lockedSocialPosts: [
      {
        lean: "Left",
        platform: "X",
        sourceLabel: "Verified AI policy researcher",
        evidenceCount: 2,
      },
      {
        lean: "Center",
        platform: "X",
        sourceLabel: "Verified markets reporter",
        evidenceCount: 2,
      },
      {
        lean: "Right",
        platform: "X",
        sourceLabel: "Verified trade analyst",
        evidenceCount: 2,
      },
    ],
  },
  {
    id: "topic-003",
    slug: "arctic-minerals-security-forum",
    category: "World",
    title: "Arctic security forum puts rare earth access on the agenda",
    kicker: "Global Affairs",
    updatedAt: "Updated 6h ago",
    readTime: "8 min read",
    heatScore: 68,
    image: "/editorial/global.png",
    imageAlt: "Monochrome editorial image of planet Earth",
    centralDevelopment:
      "Officials from several Arctic nations added rare earth supply chains to the security forum agenda after new survey data identified expanded mineral deposits.",
    neutralSummary:
      "The forum is expected to cover environmental safeguards, shipping access, and strategic resource planning, but no extraction agreement has been announced.",
    discoursePreview:
      "Left commentary is focused on environmental risk, Center voices are tracking alliance coordination, and Right commentary is highlighting strategic competition.",
    anchorArticle: {
      title: "Arctic forum expands rare earth agenda",
      source: "Placeholder Global Bureau",
      url: "https://example.com/anchor/arctic-minerals-security-forum",
    },
    sentiment: [
      {
        lean: "Left",
        score: -0.34,
        label: "Concerned",
        summary: "The dominant concern is fragile ecosystems.",
        evidenceCount: 2,
      },
      {
        lean: "Center",
        score: 0.22,
        label: "Pragmatic",
        summary: "Analysis centers on alliance coordination and supply risk.",
        evidenceCount: 2,
      },
      {
        lean: "Right",
        score: 0.48,
        label: "Supportive",
        summary: "The discussion favors strategic resource development.",
        evidenceCount: 2,
      },
    ],
    lockedSocialPosts: [
      {
        lean: "Left",
        platform: "X",
        sourceLabel: "Verified climate correspondent",
        evidenceCount: 2,
      },
      {
        lean: "Center",
        platform: "X",
        sourceLabel: "Verified defense reporter",
        evidenceCount: 2,
      },
      {
        lean: "Right",
        platform: "X",
        sourceLabel: "Verified security analyst",
        evidenceCount: 2,
      },
    ],
  },
];

export function getTopicBySlug(slug: string) {
  return placeholderTopics.find((topic) => topic.slug === slug);
}

export function getTopicsByCategory(category?: string) {
  if (!category) {
    return placeholderTopics;
  }

  return placeholderTopics.filter((topic) => topic.category === category);
}

export function getCategoryHref(category: string) {
  return `/?category=${encodeURIComponent(category)}#topics`;
}
