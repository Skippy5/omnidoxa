/**
 * Twitter Analysis Module (Refactored from grok-responses.ts)
 * 
 * Analyzes a staged article with Twitter/X data via xAI Responses API.
 * This is a PURE analysis function - it reads from staging_articles and returns
 * structured data. The caller is responsible for writing to staging tables.
 * 
 * Phase: 2.2 - Modular Twitter Analysis Core
 * Created: 2026-02-28
 */

import { turso } from '../../db-turso';
import type { StagingArticle } from '../../db-staging';

// ============================================================================
// TYPES
// ============================================================================

export type Lean = 'left' | 'center' | 'right';

export interface TwitterViewpoint {
  lean: Lean;
  summary: string;
  sentiment_score: number;
}

export interface TwitterSocialPost {
  viewpoint_lean: Lean;
  author: string;
  content: string;
  url: string;
  platform_id: string;
  likes: number;
  retweets: number;
  timestamp: string;
  is_real: boolean;
  political_leaning_source: string;
}

export interface TwitterAnalysisResult {
  viewpoints: TwitterViewpoint[];
  socialPosts: TwitterSocialPost[];
}

// ============================================================================
// INTERNAL TYPES (xAI API)
// ============================================================================

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

// ============================================================================
// CONSTANTS
// ============================================================================

const XAI_API_URL = 'https://api.x.ai/v1/responses';
const XAI_MODEL = 'grok-4-1-fast-reasoning';
const REQUEST_TIMEOUT_MS = 120_000; // 120s (matches existing logic)

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

// ============================================================================
// HELPERS
// ============================================================================

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]; // "YYYY-MM-DD"
}

function mapPerspectiveToViewpoint(
  lean: Lean,
  perspective: GrokRawPerspective
): TwitterViewpoint {
  return {
    lean,
    summary: perspective.summary ?? '',
    sentiment_score:
      typeof perspective.sentiment === 'number'
        ? Math.max(-1, Math.min(1, perspective.sentiment)) // clamp to [-1, 1]
        : 0
  };
}

function mapPerspectiveToSocialPosts(
  lean: Lean,
  perspective: GrokRawPerspective
): TwitterSocialPost[] {
  return (perspective.posts ?? []).map((post) => ({
    viewpoint_lean: lean,
    author: post.author ?? 'Unknown',
    content: post.text ?? '',
    url: post.url ?? '',
    platform_id: post.url?.split('/').pop() ?? '', // Extract tweet ID from URL
    likes: 0, // xAI does not return engagement metrics
    retweets: 0, // xAI does not return engagement metrics
    timestamp: new Date().toISOString(), // xAI does not return post dates currently
    is_real: true, // These are real posts from xAI x_search
    political_leaning_source: 'xai_responses_api'
  }));
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze a staged article with Twitter/X data via xAI Responses API
 * 
 * This is a PURE function - it reads from staging_articles and returns
 * structured data. The caller is responsible for writing results to
 * staging_viewpoints and staging_social_posts tables.
 * 
 * @param runId - Pipeline run ID
 * @param articleId - Staged article ID (from staging_articles table)
 * @returns Analysis results (viewpoints + social posts)
 * 
 * @throws Error if XAI_API_KEY is not set
 * @throws Error if article not found
 * @throws Error if xAI API call fails or times out
 * 
 * @example
 * ```typescript
 * const result = await analyzeArticleTwitter(123, 456);
 * // Write results to staging tables (caller's responsibility)
 * await writeStagingViewpoints(runId, articleId, result.viewpoints);
 * await writeStagingSocialPosts(runId, result.socialPosts);
 * ```
 */
export async function analyzeArticleTwitter(
  runId: number,
  articleId: number
): Promise<TwitterAnalysisResult> {
  // 1. Read article from staging_articles table
  const articleQuery = await turso.execute({
    sql: 'SELECT * FROM staging_articles WHERE id = ? AND run_id = ?',
    args: [articleId, runId]
  });

  if (!articleQuery.rows || articleQuery.rows.length === 0) {
    throw new Error(
      `Article not found: id=${articleId}, run_id=${runId}`
    );
  }

  const article = articleQuery.rows[0] as unknown as StagingArticle;

  console.log(
    `\n🐦 Analyzing article #${articleId}: ${article.title.substring(0, 60)}...`
  );

  // 2. Read XAI_API_KEY — throw if missing
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is not set');
  }

  // 3. Calculate date range for x_search (article date ±1 day)
  const articleDate = article.published_at
    ? new Date(article.published_at)
    : new Date(article.fetched_at);
  const fromDate = new Date(articleDate);
  fromDate.setDate(fromDate.getDate() - 1);

  const fromDateStr = toDateString(fromDate); // e.g. "2026-02-27"
  const toDateStr = toDateString(new Date()); // today

  // 4. Build user prompt
  const userPrompt = `Analyze this news story:

Title: ${article.title}
URL: ${article.url}
Summary: ${article.description ?? 'No description available'}
Published: ${article.published_at ?? article.fetched_at}

Search for real social media posts about this topic and provide LEFT/CENTER/RIGHT perspective analysis.`;

  // 5. Build request body
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

  // 6. Set up AbortController with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // 7. Make the API request
  let response: Response;
  try {
    console.log(`  🤖 Calling xAI Responses API (timeout: ${REQUEST_TIMEOUT_MS / 1000}s)...`);
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
      throw new Error(`xAI Responses API timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    }
    throw new Error(
      `xAI Responses API fetch failed: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    clearTimeout(timeoutId);
  }

  // 8. Check HTTP status
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '[unreadable]');
    throw new Error(
      `xAI Responses API returned HTTP ${response.status}: ${errorBody.substring(0, 500)}`
    );
  }

  // 9. Parse the raw JSON envelope
  const raw = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      `xAI Responses API returned non-JSON body: ${raw.substring(0, 300)}`
    );
  }

  // 10. Log token usage for cost monitoring
  const usage = (data as Record<string, unknown>).usage as
    | Record<string, number>
    | undefined;
  if (usage) {
    console.log(
      `  📊 xAI Tokens — Input: ${usage.input_tokens ?? 0}, Output: ${usage.output_tokens ?? 0}, Reasoning: ${usage.reasoning_tokens ?? 0}`
    );
  }

  // 11. Extract the assistant message text from data.output
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

  // 12. Strip markdown fences and parse JSON
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

  // 13. Validate required fields
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

  // 14. Map to structured output
  const viewpoints: TwitterViewpoint[] = [
    mapPerspectiveToViewpoint('left', grokData.left),
    mapPerspectiveToViewpoint('center', grokData.center),
    mapPerspectiveToViewpoint('right', grokData.right)
  ];

  const socialPosts: TwitterSocialPost[] = [
    ...mapPerspectiveToSocialPosts('left', grokData.left),
    ...mapPerspectiveToSocialPosts('center', grokData.center),
    ...mapPerspectiveToSocialPosts('right', grokData.right)
  ];

  const totalPosts = socialPosts.length;
  console.log(`  ✅ Analysis complete — ${totalPosts} real posts found`);

  return {
    viewpoints,
    socialPosts
  };
}
