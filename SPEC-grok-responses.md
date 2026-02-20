# SPEC: `src/lib/grok-responses.ts`

**Author:** Architect Agent  
**Date:** 2026-02-19  
**Purpose:** Technical specification for the Grok Responses API integration library.  
**Implementing Agent:** Use this document as the sole reference. No other guidance will be provided.

---

## 1. Overview

This library provides a single exported function, `analyzeWithGrokResponses`, that calls the **xAI Responses API** (`/v1/responses`) to perform political sentiment analysis on a news article using real X (Twitter) posts fetched live by Grok's `x_search` tool.

This replaces the current `convert-with-twitter-pipeline.ts` pipeline, which has Twitter API disabled and falls back to keyword-only stubs. The `sentiment-pipeline.ts` `generateKeywordFallback()` function remains the **caller-side fallback** — it is NOT called inside this library. This library either succeeds or throws.

---

## 2. File Location

```
src/lib/grok-responses.ts
```

---

## 3. Dependencies

- **No new npm packages required.** Uses Node.js built-in `fetch` and `AbortController`.
- Imports only from existing project types:
  - `NewsdataArticle` from `./newsdata`
  - `ViewpointWithPosts`, `SocialPost`, `Lean` from `./types`

---

## 4. TypeScript Types

### 4.1 Internal — Raw Grok JSON Response

This is what Grok is instructed to return as JSON. It is parsed internally and never exported.

```typescript
interface GrokRawPost {
  text: string;    // The actual post content
  author: string;  // Handle or display name (e.g. "@handle" or "Display Name")
  url: string;     // Full URL to the post, e.g. "https://x.com/..."
}

interface GrokRawPerspective {
  sentiment: number;   // -1.0 to +1.0
  summary: string;     // 2-3 sentence summary of this perspective
  posts: GrokRawPost[]; // 2-3 real posts Grok found via x_search
}

interface GrokRawResponse {
  nonBiasedSummary: string;   // 3-sentence neutral article summary
  left: GrokRawPerspective;
  center: GrokRawPerspective;
  right: GrokRawPerspective;
}
```

### 4.2 Exported — Function Return Type

```typescript
export interface GrokResponsesAnalysis {
  nonBiasedSummary: string;        // 3-sentence neutral summary of the article
  viewpoints: ViewpointWithPosts[]; // Always 3 items: left, center, right (in that order)
}
```

> **Note:** `ViewpointWithPosts` is imported from `./types`. It extends `Viewpoint` with `social_posts: SocialPost[]`. The `id`, `story_id`, and `viewpoint_id` fields are all set to `0` — the database layer assigns real IDs when persisting.

---

## 5. Main Function Signature

```typescript
export async function analyzeWithGrokResponses(
  article: NewsdataArticle
): Promise<GrokResponsesAnalysis>
```

**Parameters:**
- `article` — A `NewsdataArticle` from Newsdata.io. The function uses:
  - `article.title` — Headline
  - `article.link` — Article URL
  - `article.description` — Lead/summary
  - `article.pubDate` — Publication date (ISO string, e.g. `"2026-02-19T12:00:00Z"` or `"2026-02-19"`)

**Returns:** `Promise<GrokResponsesAnalysis>`

**Throws:** On any failure — API error, HTTP error, timeout, JSON parse failure, or missing response content. **The caller is responsible for catching and applying the fallback.**

---

## 6. Environment Variables

Read at call time (not at module load). Throw a descriptive error if missing.

```typescript
const apiKey = process.env.XAI_API_KEY;
if (!apiKey) {
  throw new Error('XAI_API_KEY environment variable is not set');
}
```

---

## 7. Date Calculation

The `x_search` tool requires `from_date` and `to_date` as `YYYY-MM-DD` strings.

```typescript
// from_date: article publication date minus 1 day
// to_date: today's date (when the function is called)

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]; // "YYYY-MM-DD"
}

// Parse the article's pubDate — it may be full ISO or date-only
const articleDate = new Date(article.pubDate);
const fromDate = new Date(articleDate);
fromDate.setDate(fromDate.getDate() - 1);

const fromDateStr = toDateString(fromDate); // e.g. "2026-02-18"
const toDateStr = toDateString(new Date()); // today, e.g. "2026-02-19"
```

---

## 8. System Prompt

Copy this **exactly** into the implementation as a string constant named `SYSTEM_PROMPT`:

```
You are an expert, truthful news sentiment analyst. Always use tools to fetch REAL data — never hallucinate articles or social posts.

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
}
```

---

## 9. User Prompt

Build this dynamically from the article at call time:

```typescript
const userPrompt = `Analyze this news story:

Title: ${article.title}
URL: ${article.link}
Summary: ${article.description ?? 'No description available'}
Published: ${article.pubDate}

Search for real social media posts about this topic and provide LEFT/CENTER/RIGHT perspective analysis.`;
```

---

## 10. API Request Body

Endpoint: `POST https://api.x.ai/v1/responses`

```typescript
const requestBody = {
  model: 'grok-4-1-fast-reasoning',
  input: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ],
  tools: [
    { type: 'web_search' },
    {
      type: 'x_search',
      from_date: fromDateStr,   // "YYYY-MM-DD", article pubDate minus 1 day
      to_date: toDateStr        // "YYYY-MM-DD", today
    }
  ],
  temperature: 0,
  max_output_tokens: 3000
};
```

**Critical notes:**
- Use `input` (NOT `messages`) — this is the Responses API, not `/chat/completions`.
- Do NOT set `stream: true`. This spec targets synchronous (non-streaming) responses.
- `temperature: 0` — deterministic output, no hallucination.
- `max_output_tokens: 3000` — sufficient for 3 perspectives × 3 posts + summaries.

---

## 11. HTTP Request with Timeout

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 90_000); // 90-second hard timeout

let response: Response;
try {
  response = await fetch('https://api.x.ai/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody),
    signal: controller.signal
  });
} catch (err: unknown) {
  clearTimeout(timeoutId);
  if (err instanceof Error && err.name === 'AbortError') {
    throw new Error('xAI Responses API timed out after 90 seconds');
  }
  throw new Error(`xAI Responses API fetch failed: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  clearTimeout(timeoutId); // Belt-and-suspenders: always clear
}
```

> **Important:** Place `clearTimeout(timeoutId)` both in the `catch` and in a `finally` block (or just `finally`) to avoid leaking the timer on success paths too.

---

## 12. HTTP Error Handling

After the `fetch` call succeeds (no network error), check the HTTP status:

```typescript
if (!response.ok) {
  const errorBody = await response.text().catch(() => '[unreadable]');
  throw new Error(
    `xAI Responses API returned HTTP ${response.status}: ${errorBody.substring(0, 500)}`
  );
}
```

---

## 13. Response Parsing

### 13.1 Parse the Raw JSON Envelope

```typescript
const raw = await response.text();
let data: unknown;
try {
  data = JSON.parse(raw);
} catch {
  throw new Error(`xAI Responses API returned non-JSON body: ${raw.substring(0, 300)}`);
}
```

### 13.2 Extract the Assistant Message Text

The Responses API returns a `data.output` array. Scan it for an item where `item.type === 'message'` and `item.role === 'assistant'`. The text content is at `item.content[0].text` (content type is `output_text`).

```typescript
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
```

### 13.3 Strip Markdown and Parse JSON

Grok is instructed to return raw JSON, but defensively strip markdown code fences in case it wraps the output:

```typescript
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
```

### 13.4 Validate Required Fields

After parsing, validate that the required top-level keys are present:

```typescript
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
```

---

## 14. Mapping to `ViewpointWithPosts`

Convert the raw Grok response into OmniDoxa's `ViewpointWithPosts[]`. All database ID fields (`id`, `story_id`, `viewpoint_id`) are set to `0` — the persistence layer assigns real IDs.

```typescript
function mapPerspective(
  lean: Lean,
  perspective: GrokRawPerspective
): ViewpointWithPosts {
  const socialPosts: SocialPost[] = (perspective.posts ?? []).map((post) => ({
    id: 0,
    viewpoint_id: 0,
    author: post.author ?? 'Unknown',
    author_handle: post.author?.startsWith('@') ? post.author : `@${post.author ?? 'unknown'}`,
    text: post.text ?? '',
    url: post.url ?? '',
    platform: 'x',
    likes: 0,       // xAI does not return engagement metrics
    retweets: 0,    // xAI does not return engagement metrics
    created_at: new Date().toISOString()
  }));

  return {
    id: 0,
    story_id: 0,
    lean,
    summary: perspective.summary ?? '',
    sentiment_score: typeof perspective.sentiment === 'number'
      ? Math.max(-1, Math.min(1, perspective.sentiment))  // clamp to [-1, 1]
      : 0,
    created_at: new Date().toISOString(),
    social_posts: socialPosts
  };
}
```

**Note on `author_handle`:** The Grok response's `author` field may already include the `@` prefix (e.g., `"@elonmusk"`) or may be a display name without it. The mapping function normalizes this: if the value already starts with `@`, use it as-is; otherwise prepend `@`. The `author` field on `SocialPost` stores the raw value from Grok (display name or handle as received).

**Note on `platform`:** Use `'x'` (not `'twitter'`) — this is the current platform name.

---

## 15. Building the Final Return Value

```typescript
const viewpoints: ViewpointWithPosts[] = [
  mapPerspective('left', grokData.left),
  mapPerspective('center', grokData.center),
  mapPerspective('right', grokData.right)
];

return {
  nonBiasedSummary: grokData.nonBiasedSummary,
  viewpoints
};
```

---

## 16. Full Function Flow (Pseudocode Summary)

```
analyzeWithGrokResponses(article):
  1. Read XAI_API_KEY from process.env — throw if missing
  2. Calculate fromDateStr (pubDate - 1 day) and toDateStr (today)
  3. Build userPrompt string from article fields
  4. Set up AbortController with 90s setTimeout
  5. POST to https://api.x.ai/v1/responses with:
       - model: 'grok-4-1-fast-reasoning'
       - input: [system prompt, user prompt]
       - tools: [web_search, x_search with dates]
       - temperature: 0, max_output_tokens: 3000
  6. Clear timeout (finally block)
  7. Throw on AbortError (timeout) or network error
  8. Throw on non-2xx HTTP status (include body in error)
  9. Parse response body as JSON
  10. Find assistant message in data.output array
  11. Throw if no assistant message found
  12. Strip markdown fences from content text
  13. Parse content text as JSON (GrokRawResponse)
  14. Validate required fields — throw if missing
  15. Map left/center/right perspectives to ViewpointWithPosts[]
  16. Return { nonBiasedSummary, viewpoints }
```

---

## 17. Complete File Structure

```typescript
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
  viewpoints: ViewpointWithPosts[];  // [left, center, right]
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
const REQUEST_TIMEOUT_MS = 90_000;

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

function toDateString(date: Date): string { ... }

function mapPerspective(lean: Lean, perspective: GrokRawPerspective): ViewpointWithPosts { ... }

// ── Main Export ───────────────────────────────────────────────────────────────

export async function analyzeWithGrokResponses(
  article: NewsdataArticle
): Promise<GrokResponsesAnalysis> { ... }
```

---

## 18. Error Handling Summary

| Condition | Error Message Pattern | Behavior |
|---|---|---|
| `XAI_API_KEY` not set | `"XAI_API_KEY environment variable is not set"` | Throw immediately |
| Request exceeds 90s | `"xAI Responses API timed out after 90 seconds"` | AbortController fires, throw on AbortError |
| Network/fetch failure | `"xAI Responses API fetch failed: <message>"` | Throw with underlying error |
| HTTP non-2xx | `"xAI Responses API returned HTTP <N>: <body>"` | Throw with status + body |
| Response body is not JSON | `"xAI Responses API returned non-JSON body: <preview>"` | Throw |
| No assistant message in output | `"xAI Responses API returned no assistant message content"` | Throw |
| Content is not valid JSON | `"xAI response is not valid JSON: <preview>"` | Throw |
| Missing required JSON fields | `"xAI response JSON is missing required fields (...)"` | Throw |

**All errors are thrown.** The caller (`convert-with-twitter-pipeline.ts` or the API route that replaces it) is responsible for catching and invoking `generateKeywordFallback()` from `sentiment-pipeline.ts`.

---

## 19. Caller Integration Pattern

The developer writing the caller (e.g., a new `convertToStoryWithGrokResponses` function) should follow this pattern:

```typescript
import { analyzeWithGrokResponses } from './grok-responses';
import { generateKeywordFallback } from './sentiment-pipeline';

try {
  const analysis = await analyzeWithGrokResponses(article);
  // Use analysis.viewpoints and analysis.nonBiasedSummary
} catch (err) {
  console.error('Grok Responses API failed, using fallback:', err);
  const viewpoints = generateKeywordFallback({
    title: article.title,
    description: article.description ?? undefined,
    category
  });
  // Use fallback viewpoints (no posts, generic summaries)
}
```

---

## 20. Token Usage Logging (Optional but Recommended)

The Responses API returns a `usage` object on the response envelope. Log it for cost monitoring:

```typescript
// After parsing `data`:
const usage = (data as Record<string, unknown>).usage as Record<string, number> | undefined;
if (usage) {
  console.log(`  📊 xAI Tokens — Input: ${usage.input_tokens ?? 0}, Output: ${usage.output_tokens ?? 0}, Reasoning: ${usage.reasoning_tokens ?? 0}`);
}
```

Note: The Responses API uses `input_tokens` / `output_tokens` (not `prompt_tokens` / `completion_tokens`).

---

## 21. What This Library Does NOT Do

- Does NOT write to the database (caller's responsibility)
- Does NOT fall back to keywords (caller's responsibility)  
- Does NOT batch-process articles (caller's responsibility)
- Does NOT cache results (caller's responsibility)
- Does NOT set `story_id` on viewpoints (set to `0`; DB layer assigns real ID)
- Does NOT stream responses (synchronous fetch only)
- Does NOT retry on failure (single attempt; caller may retry)

---

*End of spec. Implement `src/lib/grok-responses.ts` from this document alone.*
