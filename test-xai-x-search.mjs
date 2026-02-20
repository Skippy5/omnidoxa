/**
 * TEST: xAI x_search + web_search tools via direct HTTP (TypeScript-compatible .mjs)
 * 
 * Tests whether x_search works via direct Node.js fetch (no Python, no SDK)
 * and whether we get real tweets back for a political news article.
 * 
 * Run: node test-xai-x-search.mjs
 */

import { readFileSync } from 'fs';

// --- Config ---
const ENV = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => l.split('=').map(p => p.trim()))
);

const API_KEY = ENV.XAI_API_KEY;
if (!API_KEY) {
  console.error('❌ XAI_API_KEY not found in .env.local');
  process.exit(1);
}

// --- Test Article (FOMC/Powell - politically relevant) ---
const TEST_ARTICLE = {
  title: "FOMC minutes showed Powell to remain as Chair for all of 2026. Gridlock, here's why.",
  url: "https://investinglive.com/centralbank/fomc-minutes-showed-powell-to-remain-as-chair-for-all-of-2026-gridlock-heres-why-20260219/",
  description: "FOMC minutes reaffirm Powell as chair until a successor is selected. Kevin Warsh confirmation timeline is at risk. Sen. Thom Tillis threatening to block Fed nominees. Democrats also pressing to delay proceedings.",
  publishedAt: "2026-02-19"
};

// --- System Prompt ---
const SYSTEM_PROMPT = `You are an expert, truthful news sentiment analyst. Always use tools to fetch REAL data — never hallucinate articles or social posts.

For the provided news story, do the following:

1. Use web_search to browse the article URL and get the full text if needed.
2. Use x_search to find 2–3 real, recent posts from the LEFT political perspective about this topic (from liberal/progressive users or accounts).
3. Use x_search to find 2–3 real, recent posts from the CENTER perspective (neutral/moderate accounts).
4. Use x_search to find 2–3 real, recent posts from the RIGHT political perspective (from conservative/Republican users or accounts).

For each perspective provide:
- A sentiment score (-1.0 very negative to +1.0 very positive)
- A 2-3 sentence summary of how that side views this story
- The real social posts you found (text, author handle, URL)

Output ONLY valid JSON in this exact format:
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

const USER_PROMPT = `Analyze this news story:

Title: ${TEST_ARTICLE.title}
URL: ${TEST_ARTICLE.url}
Summary: ${TEST_ARTICLE.description}
Published: ${TEST_ARTICLE.publishedAt}

Search for real social media posts about this topic and provide LEFT/CENTER/RIGHT perspective analysis.`;

// --- Make the API Call ---
async function runTest() {
  console.log('🚀 Testing xAI API with x_search + web_search tools...');
  console.log(`📰 Article: ${TEST_ARTICLE.title.substring(0, 60)}...`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 15)}...`);
  console.log('');

  const startTime = Date.now();

  // Set a hard timeout of 90 seconds
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error('⏰ TIMEOUT: Request exceeded 90 seconds — aborting');
    controller.abort();
  }, 90000);

  try {
    // Use the Responses API (/v1/responses) with x_search + web_search tools
    // NOTE: NOT /v1/chat/completions — that endpoint doesn't support these tools
    const response = await fetch('https://api.x.ai/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-4-1-fast-reasoning',
        input: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: USER_PROMPT }
        ],
        tools: [
          { type: 'web_search' },
          {
            type: 'x_search',
            from_date: '2026-02-01',   // Search recent posts about this story
            to_date: '2026-02-19'
          }
        ],
        temperature: 0,
        max_output_tokens: 3000
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`⏱️  Response received in ${elapsed}s`);
    console.log(`📡 HTTP Status: ${response.status}`);

    const raw = await response.text();

    if (!response.ok) {
      console.error('❌ API Error Response:');
      console.error(raw);
      process.exit(1);
    }

    const data = JSON.parse(raw);

    // Responses API returns output array with message items
    // Find the text content from the assistant message
    let content = null;
    if (data.output) {
      // Responses API format: data.output = array of items
      for (const item of data.output) {
        if (item.type === 'message' && item.role === 'assistant') {
          for (const c of item.content || []) {
            if (c.type === 'output_text' || c.type === 'text') {
              content = c.text;
              break;
            }
          }
        }
      }
    }
    // Fallback: chat completions format
    if (!content) {
      content = data.choices?.[0]?.message?.content;
    }

    if (!content) {
      console.error('❌ No content in response');
      console.error(JSON.stringify(data, null, 2).substring(0, 2000));
      process.exit(1);
    }

    console.log('');
    console.log('✅ Got response content!');
    console.log('');

    // Show usage stats (Responses API uses input_tokens/output_tokens)
    const usage = data.usage;
    if (usage) {
      console.log('📊 Token Usage:');
      console.log(`   Input:     ${(usage.input_tokens || usage.prompt_tokens || 0).toLocaleString()} tokens`);
      console.log(`   Output:    ${(usage.output_tokens || usage.completion_tokens || 0).toLocaleString()} tokens`);
      console.log(`   Reasoning: ${(usage.reasoning_tokens || 0).toLocaleString()} tokens`);
      console.log(`   Total:     ${(usage.total_tokens || 0).toLocaleString()} tokens`);
      console.log('');
    }

    // Try to parse as JSON
    let parsed = null;
    try {
      // Strip markdown code blocks if present
      const cleaned = content.replace(/^```json\n?/m, '').replace(/^```\n?/m, '').replace(/```$/m, '').trim();
      parsed = JSON.parse(cleaned);
      console.log('✅ Response is valid JSON!');
      console.log('');
      console.log('📋 RESULTS:');
      console.log(`   Summary: ${parsed.nonBiasedSummary?.substring(0, 100)}...`);
      console.log('');
      console.log(`   LEFT (score: ${parsed.left?.sentiment}): ${parsed.left?.summary?.substring(0, 80)}...`);
      console.log(`   LEFT posts found: ${parsed.left?.posts?.length || 0}`);
      if (parsed.left?.posts?.length > 0) {
        console.log(`   First LEFT post: @${parsed.left.posts[0].author} — ${parsed.left.posts[0].text?.substring(0, 60)}...`);
        console.log(`   URL: ${parsed.left.posts[0].url}`);
      }
      console.log('');
      console.log(`   CENTER (score: ${parsed.center?.sentiment}): ${parsed.center?.summary?.substring(0, 80)}...`);
      console.log(`   CENTER posts found: ${parsed.center?.posts?.length || 0}`);
      console.log('');
      console.log(`   RIGHT (score: ${parsed.right?.sentiment}): ${parsed.right?.summary?.substring(0, 80)}...`);
      console.log(`   RIGHT posts found: ${parsed.right?.posts?.length || 0}`);
      if (parsed.right?.posts?.length > 0) {
        console.log(`   First RIGHT post: @${parsed.right.posts[0].author} — ${parsed.right.posts[0].text?.substring(0, 60)}...`);
        console.log(`   URL: ${parsed.right.posts[0].url}`);
      }
    } catch (e) {
      console.log('⚠️  Response is NOT valid JSON (may be markdown/text):');
      console.log(content.substring(0, 1000));
    }

    console.log('');
    console.log(`✅ TEST COMPLETE in ${elapsed}s`);
    console.log('');
    console.log('--- FULL RAW CONTENT ---');
    console.log(content);

  } catch (err) {
    clearTimeout(timeoutId);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    if (err.name === 'AbortError') {
      console.error(`❌ ABORTED after ${elapsed}s (timeout)`);
    } else {
      console.error(`❌ Fetch error after ${elapsed}s:`, err.message);
    }
    process.exit(1);
  }
}

runTest();
