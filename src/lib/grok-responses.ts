/**
 * Grok Responses API Integration
 *
 * Analyzes a news article using xAI's Responses API with x_search and web_search tools.
 * Returns LEFT/CENTER/RIGHT political perspectives with real X posts.
 *
 * Endpoint: POST https://api.x.ai/v1/responses  (NOT /chat/completions)
 * Model:    grok-4-1-fast-reasoning
 * Timeout:  90 seconds (hard abort)
 */

import type { NewsdataArticle } from './newsdata';
import type { ViewpointWithPosts, SocialPost, Lean } from './types';

// ── Exported Types ────────────────────────────────────────────────────────────

export interface GrokResponsesAnalysis {
  nonBiasedSummary: string;
  viewpoints: ViewpointWithPosts[]; // [left, center, right]
}

// ── Internal Types ────────────────────────────────────────────────────────────

interface GrokRawPost {
  text: string;
  author: string;
  url: string;
}

interface GrokRawPerspective {
  sentiment: number;
  summary: string;
  posts: GrokRawPost[];
}

interface GrokRawResponse {
  nonBiasedSummary: string;
  left: GrokRawPerspective;
  center: GrokRawPerspective;
  right: GrokRawPerspective;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const XAI_API_URL = 'https://api.x.ai/v1/responses';
const XAI_MODEL = 'grok-4-1-fast-reasoning';
const REQUEST_TIMEOUT_MS = 120_000; // 120s — skip article if exceeded

const SYSTEM_PROMPT = `You are an expert, truthful news sentiment analyst. Always use tools to fetch REAL data — never hallucinate articles or social posts.

For the provided news story, do the following:

1. Use web_search to browse the article URL and get the full text if needed.
2. Use x_search to find 2–3 real, recent posts from the LEFT political perspective about this topic (from liberal/progressive/Democrat users or accounts).
3. Use x_search to find 2–3 real, recent posts from the CENTER perspective (neutral/moderate/journalist/analyst accounts).
4. Use x_search to find 2–3 real, recent posts from the RIGHT political perspective (from conservative/Republican users or accounts).

For each perspective provide:
- A sentiment score (-1.0 very negative to +1.0 very positive)
- A 2-3 sentence summary of how that side views this story
- The real social posts you found (text, author handle, URL)

Output ONLY valid JSON in this exact format — no markdown, no code blocks, no extra text:
{
  "nonBiasedSummary": "3-sentence neutral summary of the story",
  "left": {
    "sentiment": 0.0,
    "summary": "How the left views this...",
    "posts": [
      {
        "text": "actual post text",
        "author": "handle or name",
        "url": "https://x.com/..."
      }
    ]
  },
  "center": {
    "sentiment": 0.0,
    "summary": "How centrists view this...",
    "posts": []
  },
  "right": {
    "sentiment": 0.0,
    "summary": "How the right views this...",
    "posts": []
  }
}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]; // "YYYY-MM-DD"
}

function mapPerspective(
  lean: Lean,
  perspective: GrokRawPerspective
): ViewpointWithPosts {
  const socialPosts: SocialPost[] = (perspective.posts ?? []).map((post) => ({
    id: 0,
    viewpoint_id: 0,
    author: post.author ?? 'Unknown',
    author_handle: post.author?.startsWith('@')
      ? post.author
      : `@${post.author ?? 'unknown'}`,
    text: post.text ?? '',
    url: post.url ?? '',
    platform: 'x',
    likes: 0,       // xAI does not return engagement metrics
    retweets: 0,    // xAI does not return engagement metrics
    is_real: true,  // These are real posts from xAI x_search
    post_date: null, // xAI does not return post dates currently
    created_at: new Date().toISOString()
  }));

  return {
    id: 0,
    story_id: 0,
    lean,
    summary: perspective.summary ?? '',
    sentiment_score:
      typeof perspective.sentiment === 'number'
        ? Math.max(-1, Math.min(1, perspective.sentiment)) // clamp to [-1, 1]
        : 0,
    created_at: new Date().toISOString(),
    social_posts: socialPosts
  };
}

// ── Main Export ───────────────────────────────────────────────────────────────

export async function analyzeWithGrokResponses(
  article: NewsdataArticle
): Promise<GrokResponsesAnalysis> {
  // 1. Read XAI_API_KEY — throw if missing
  const apiKey = process.env.XAI_API_KEY;
  console.log(`🔑 Using XAI_API_KEY: ${apiKey?.slice(0, 10)}...${apiKey?.slice(-4)}`);
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is not set');
  }

  // 2. Calculate date range for x_search
  const articleDate = new Date(article.pubDate);
  const fromDate = new Date(articleDate);
  fromDate.setDate(fromDate.getDate() - 1);

  const fromDateStr = toDateString(fromDate); // e.g. "2026-02-18"
  const toDateStr = toDateString(new Date()); // today, e.g. "2026-02-19"

  // 3. Build user prompt
  const userPrompt = `Analyze this news story:

Title: ${article.title}
URL: ${article.link}
Summary: ${article.description ?? 'No description available'}
Published: ${article.pubDate}

Search for real social media posts about this topic and provide LEFT/CENTER/RIGHT perspective analysis.`;

  // 4. Build request body
  const requestBody = {
    model: XAI_MODEL,
    input: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    tools: [
      { type: 'web_search' },
      {
        type: 'x_search',
        from_date: fromDateStr,
        to_date: toDateStr
      }
    ],
    temperature: 0,
    max_output_tokens: 3000
  };

  // 5. Set up AbortController with 90s timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // 6. Make the API request
  let response: Response;
  try {
    response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('xAI Responses API timed out after 90 seconds');
    }
    throw new Error(
      `xAI Responses API fetch failed: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    clearTimeout(timeoutId);
  }

  // 7. Check HTTP status
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '[unreadable]');
    throw new Error(
      `xAI Responses API returned HTTP ${response.status}: ${errorBody.substring(0, 500)}`
    );
  }

  // 8. Parse the raw JSON envelope
  const raw = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      `xAI Responses API returned non-JSON body: ${raw.substring(0, 300)}`
    );
  }

  // 9. Log token usage for cost monitoring
  const usage = (data as Record<string, unknown>).usage as
    | Record<string, number>
    | undefined;
  if (usage) {
    console.log(
      `  📊 xAI Tokens — Input: ${usage.input_tokens ?? 0}, Output: ${usage.output_tokens ?? 0}, Reasoning: ${usage.reasoning_tokens ?? 0}`
    );
  }

  // 10. Extract the assistant message text from data.output
  let contentText: string | null = null;

  const output = (data as Record<string, unknown>).output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (
        item &&
        typeof item === 'object' &&
        (item as Record<string, unknown>).type === 'message' &&
        (item as Record<string, unknown>).role === 'assistant'
      ) {
        const contents = (item as Record<string, unknown>).content;
        if (Array.isArray(contents)) {
          for (const c of contents) {
            if (
              c &&
              typeof c === 'object' &&
              ((c as Record<string, unknown>).type === 'output_text' ||
                (c as Record<string, unknown>).type === 'text')
            ) {
              contentText = (c as Record<string, unknown>).text as string;
              break;
            }
          }
        }
        if (contentText) break;
      }
    }
  }

  if (!contentText) {
    throw new Error('xAI Responses API returned no assistant message content');
  }

  // 11. Strip markdown fences and parse JSON
  const cleaned = contentText
    .replace(/^```json\s*/m, '')
    .replace(/^```\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim();

  let grokData: GrokRawResponse;
  try {
    grokData = JSON.parse(cleaned) as GrokRawResponse;
  } catch {
    throw new Error(
      `xAI response is not valid JSON: ${cleaned.substring(0, 500)}`
    );
  }

  // 12. Validate required fields
  if (
    !grokData.nonBiasedSummary ||
    !grokData.left ||
    !grokData.center ||
    !grokData.right
  ) {
    throw new Error(
      'xAI response JSON is missing required fields (nonBiasedSummary, left, center, right)'
    );
  }

  // 13. Map to ViewpointWithPosts[] and return
  const viewpoints: ViewpointWithPosts[] = [
    mapPerspective('left', grokData.left),
    mapPerspective('center', grokData.center),
    mapPerspective('right', grokData.right)
  ];

  return {
    nonBiasedSummary: grokData.nonBiasedSummary,
    viewpoints
  };
}
