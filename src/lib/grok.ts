import "server-only";

const XAI_RESPONSES_URL = "https://api.x.ai/v1/responses";
const DEFAULT_MODEL = "grok-4-1-fast-reasoning";
const REQUEST_TIMEOUT_MS = 55_000;
const DEFAULT_SEARCH_WINDOW_DAYS = 14;
const LEANS = ["left", "center", "right"] as const;

type Lean = (typeof LEANS)[number];

type XaiResponseTool = {
  type: "web_search" | "x_search";
  from_date?: string;
  to_date?: string;
};

export type GrokArticleInput = {
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
};

export type GrokTopicInput = {
  title: string;
  centralDevelopment: string | null;
  anchorArticle: GrokArticleInput;
  materialUpdates: GrokArticleInput[];
};

export type GrokSocialPost = {
  author: string | null;
  authorHandle: string | null;
  text: string;
  url: string;
  likes: number;
  retweets: number;
  postDate: string | null;
};

export type GrokViewpoint = {
  lean: Lean;
  label: string;
  summary: string;
  sentimentScore: number;
  posts: GrokSocialPost[];
};

export type GrokSentimentAnalysis = {
  neutralTopicSummary: string;
  discourseSummary: string;
  discoursePreview: string;
  analyticalSentiment: string;
  viewpoints: GrokViewpoint[];
  model: string;
  searchWindow: {
    fromDate: string;
    toDate: string;
  };
  rawResponse: unknown;
};

export class GrokAnalysisError extends Error {
  rawResponse: unknown;
  model: string;
  searchWindow: {
    fromDate: string;
    toDate: string;
  };

  constructor({
    message,
    rawResponse,
    model,
    searchWindow,
  }: {
    message: string;
    rawResponse: unknown;
    model: string;
    searchWindow: {
      fromDate: string;
      toDate: string;
    };
  }) {
    super(message);
    this.name = "GrokAnalysisError";
    this.rawResponse = rawResponse;
    this.model = model;
    this.searchWindow = searchWindow;
  }
}

type ParsedPerspective = {
  lean?: unknown;
  viewpoint?: unknown;
  perspective?: unknown;
  sentimentScore?: unknown;
  sentiment_score?: unknown;
  score?: unknown;
  sentiment?: unknown;
  label?: unknown;
  summary?: unknown;
  realSocialPosts?: unknown;
  real_social_posts?: unknown;
  posts?: unknown;
  socialPosts?: unknown;
  social_posts?: unknown;
  tweets?: unknown;
};

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function isoDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function searchWindowFor(input: GrokTopicInput) {
  const toDate = new Date();
  const fallbackStart = new Date(toDate);
  fallbackStart.setUTCDate(fallbackStart.getUTCDate() - DEFAULT_SEARCH_WINDOW_DAYS);

  const published = parseDate(input.anchorArticle.publishedAt);
  const fromDate =
    published && published > fallbackStart && published <= toDate
      ? published
      : fallbackStart;

  return {
    fromDate: isoDateOnly(fromDate),
    toDate: isoDateOnly(toDate),
  };
}

function systemPrompt() {
  return [
    "You are an expert, truthful news sentiment analyst.",
    "Always use tools to fetch REAL data; never hallucinate articles or social posts.",
    "Use web_search to browse the article URL and get the full text if needed.",
    "Use x_search to find 3-5 real, recent posts from the LEFT perspective.",
    "Use x_search to find 3-5 real, recent posts from the CENTER perspective.",
    "Use x_search to find 3-5 real, recent posts from the RIGHT perspective.",
    "For each perspective provide a sentiment score from -1.0 to +1.0, a 2-3 sentence summary, and real social posts with text, author handle, and URL.",
    "Output ONLY valid JSON with keys: nonBiasedSummary, left, center, right.",
    "Each perspective must use this shape: { \"sentimentScore\": number, \"summary\": string, \"posts\": [{ \"text\": string, \"authorHandle\": string, \"url\": string, \"author\": string | null, \"likes\": number | null, \"retweets\": number | null, \"postDate\": string | null }] }.",
  ].join("\n");
}

function userPrompt(input: GrokTopicInput) {
  const materialUpdates =
    input.materialUpdates.length > 0
      ? input.materialUpdates
          .map(
            (article, index) =>
              `${index + 1}. ${article.title}\nURL: ${article.url}\nSummary: ${
                article.summary ?? "No description available"
              }\nPublished: ${article.publishedAt ?? "Unknown"}`,
          )
          .join("\n\n")
      : "None";

  return [
    "Analyze this news story:",
    `Topic: ${input.title}`,
    `Central Development: ${
      input.centralDevelopment ?? "No central development provided"
    }`,
    `Title: ${input.anchorArticle.title}`,
    `URL: ${input.anchorArticle.url}`,
    `Summary: ${input.anchorArticle.summary ?? "No description available"}`,
    `Published: ${input.anchorArticle.publishedAt ?? "Unknown"}`,
    "",
    "Material Update sources:",
    materialUpdates,
    "",
    "Search for real social media posts about this topic and provide LEFT/CENTER/RIGHT perspective analysis.",
  ].join("\n");
}

function numberInRange(value: unknown, fallback = 0) {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.max(-1, Math.min(1, numberValue));
}

function integerOrZero(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.floor(numberValue)
    : 0;
}

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function xPostUrl(value: unknown) {
  const text = textOrNull(value);

  if (!text) {
    return null;
  }

  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();

    if (
      host === "x.com" ||
      host.endsWith(".x.com") ||
      host === "twitter.com" ||
      host.endsWith(".twitter.com")
    ) {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function normalizePost(rawPost: unknown) {
  if (!rawPost || typeof rawPost !== "object") {
    return null;
  }

  const post = rawPost as Record<string, unknown>;
  const authorObject = objectValue(post.author);
  const userObject = objectValue(post.user);
  const text =
    textOrNull(post.text) ??
    textOrNull(post.content) ??
    textOrNull(post.postText) ??
    textOrNull(post.post_text);
  const url = xPostUrl(post.url ?? post.link ?? post.postUrl ?? post.post_url);
  const authorHandle =
    textOrNull(post.authorHandle) ??
    textOrNull(post.author_handle) ??
    textOrNull(post.userHandle) ??
    textOrNull(post.user_handle) ??
    textOrNull(post.handle) ??
    textOrNull(post.username) ??
    textOrNull(authorObject?.handle) ??
    textOrNull(authorObject?.username) ??
    textOrNull(userObject?.handle) ??
    textOrNull(userObject?.username);

  if (!text || !url || !authorHandle) {
    return null;
  }

  return {
    author:
      textOrNull(post.author) ??
      textOrNull(authorObject?.name) ??
      textOrNull(userObject?.name),
    authorHandle,
    text,
    url,
    likes: integerOrZero(
      post.likes ?? post.like_count ?? post.favorite_count,
    ),
    retweets: integerOrZero(
      post.retweets ?? post.reposts ?? post.repost_count ?? post.retweet_count,
    ),
    postDate:
      textOrNull(post.postDate) ??
      textOrNull(post.post_date) ??
      textOrNull(post.created_at) ??
      textOrNull(post.date) ??
      textOrNull(post.publishedAt),
  } satisfies GrokSocialPost;
}

function perspectiveScore(rawPerspective: ParsedPerspective) {
  const sentiment = objectValue(rawPerspective.sentiment);

  return numberInRange(
    rawPerspective.sentimentScore ??
      rawPerspective.sentiment_score ??
      rawPerspective.score ??
      sentiment?.score,
  );
}

function normalizePerspective(
  lean: Lean,
  rawPerspective: ParsedPerspective | undefined,
) {
  if (!rawPerspective || typeof rawPerspective !== "object") {
    throw new Error(`Grok response is missing the ${lean} perspective.`);
  }

  const summary = textOrNull(rawPerspective.summary);
  const rawPosts =
    rawPerspective.posts ??
    rawPerspective.realSocialPosts ??
    rawPerspective.real_social_posts ??
    rawPerspective.socialPosts ??
    rawPerspective.social_posts ??
    rawPerspective.tweets;
  const posts = Array.isArray(rawPosts)
    ? rawPosts.map((post) => normalizePost(post)).filter((post) => post !== null)
    : [];

  if (!summary) {
    throw new Error(`Grok response is missing the ${lean} summary.`);
  }

  if (posts.length === 0) {
    throw new Error(`Grok response did not include valid ${lean} X posts.`);
  }

  return {
    lean,
    label: textOrNull(rawPerspective.label) ?? sentimentLabel(perspectiveScore(rawPerspective)),
    summary,
    sentimentScore: perspectiveScore(rawPerspective),
    posts,
  } satisfies GrokViewpoint;
}

function sentimentLabel(score: number) {
  if (score <= -0.45) {
    return "Critical";
  }

  if (score < -0.12) {
    return "Skeptical";
  }

  if (score <= 0.12) {
    return "Measured";
  }

  if (score < 0.45) {
    return "Cautiously Supportive";
  }

  return "Supportive";
}

function compactDiscoursePreview(viewpoints: GrokViewpoint[]) {
  const labels = viewpoints
    .map((viewpoint) => `${viewpoint.lean}: ${viewpoint.label.toLowerCase()}`)
    .join("; ");

  return `Early discourse is split across ${labels}. Full supporting posts remain in editorial review.`;
}

function extractResponseText(response: unknown): string {
  if (!response || typeof response !== "object") {
    return "";
  }

  const candidate = response as Record<string, unknown>;

  if (typeof candidate.output_text === "string") {
    return candidate.output_text;
  }

  if (Array.isArray(candidate.output)) {
    const pieces: string[] = [];

    for (const item of candidate.output) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const outputItem = item as Record<string, unknown>;

      if (typeof outputItem.text === "string") {
        pieces.push(outputItem.text);
      }

      if (Array.isArray(outputItem.content)) {
        for (const content of outputItem.content) {
          if (!content || typeof content !== "object") {
            continue;
          }

          const contentItem = content as Record<string, unknown>;

          if (typeof contentItem.text === "string") {
            pieces.push(contentItem.text);
          }
        }
      }
    }

    if (pieces.length > 0) {
      return pieces.join("\n");
    }
  }

  if (Array.isArray(candidate.choices)) {
    const firstChoice = candidate.choices[0] as Record<string, unknown> | undefined;
    const message = firstChoice?.message as Record<string, unknown> | undefined;

    if (typeof message?.content === "string") {
      return message.content;
    }
  }

  return "";
}

function parseJsonObject(text: string) {
  const withoutFence = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Grok response did not contain a JSON object.");
  }

  return JSON.parse(withoutFence.slice(start, end + 1)) as Record<string, unknown>;
}

function leanFromPerspective(value: unknown) {
  const text = textOrNull(value)?.toLowerCase();

  if (text === "left" || text === "center" || text === "right") {
    return text as Lean;
  }

  return null;
}

function perspectiveForLean(parsed: Record<string, unknown>, lean: Lean) {
  const direct = parsed[lean];

  if (direct && typeof direct === "object") {
    return direct as ParsedPerspective;
  }

  const perspectives = parsed.perspectives;

  if (!Array.isArray(perspectives)) {
    return undefined;
  }

  return perspectives.find((rawPerspective) => {
    const perspective = rawPerspective as ParsedPerspective;

    return (
      leanFromPerspective(perspective.lean) === lean ||
      leanFromPerspective(perspective.viewpoint) === lean ||
      leanFromPerspective(perspective.perspective) === lean
    );
  }) as ParsedPerspective | undefined;
}

function normalizeResponse(response: unknown, model: string, window: ReturnType<typeof searchWindowFor>) {
  const text = extractResponseText(response);
  const parsed = parseJsonObject(text);
  const neutralTopicSummary =
    textOrNull(parsed.nonBiasedSummary) ??
    textOrNull(parsed.non_biased_summary) ??
    textOrNull(parsed.neutralTopicSummary) ??
    textOrNull(parsed.neutral_summary) ??
    textOrNull(parsed.summary);

  if (!neutralTopicSummary) {
    throw new Error("Grok response is missing nonBiasedSummary.");
  }

  const viewpoints = LEANS.map((lean) =>
    normalizePerspective(lean, perspectiveForLean(parsed, lean)),
  );

  return {
    neutralTopicSummary,
    discourseSummary:
      textOrNull(parsed.discourseSummary) ??
      viewpoints.map((viewpoint) => viewpoint.summary).join("\n\n"),
    discoursePreview:
      textOrNull(parsed.discoursePreview) ?? compactDiscoursePreview(viewpoints),
    analyticalSentiment:
      textOrNull(parsed.analyticalSentiment) ?? "Editorial review pending",
    viewpoints,
    model,
    searchWindow: window,
    rawResponse: response,
  } satisfies GrokSentimentAnalysis;
}

export async function analyzeTopicWithGrok(input: GrokTopicInput) {
  const apiKey = requiredEnv("XAI_API_KEY");
  const model = process.env.XAI_MODEL || DEFAULT_MODEL;
  const window = searchWindowFor(input);
  const controller = new AbortController();
  const timeout = windowThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const tools: XaiResponseTool[] = [
    { type: "web_search" },
    {
      type: "x_search",
      from_date: window.fromDate,
      to_date: window.toDate,
    },
  ];

  try {
    const response = await fetch(XAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: systemPrompt(),
          },
          {
            role: "user",
            content: userPrompt(input),
          },
        ],
        tools,
        temperature: 0,
        max_output_tokens: 3000,
      }),
      signal: controller.signal,
    });

    const rawResponse = (await response.json()) as unknown;

    if (!response.ok) {
      const message =
        rawResponse && typeof rawResponse === "object"
          ? JSON.stringify(rawResponse).slice(0, 500)
          : response.statusText;

      throw new GrokAnalysisError({
        message: `xAI analysis request failed: ${message}`,
        rawResponse,
        model,
        searchWindow: window,
      });
    }

    try {
      return normalizeResponse(rawResponse, model, window);
    } catch (error) {
      throw new GrokAnalysisError({
        message:
          error instanceof Error
            ? error.message
            : "Could not parse xAI analysis response.",
        rawResponse,
        model,
        searchWindow: window,
      });
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("xAI analysis request timed out.");
    }

    throw error;
  } finally {
    windowThis.clearTimeout(timeout);
  }
}

const windowThis: Pick<typeof globalThis, "setTimeout" | "clearTimeout"> = globalThis;
