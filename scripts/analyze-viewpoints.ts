/**
 * Build-time script: Analyzes stories with Grok (xAI) for L/C/R viewpoints.
 * Reads public/stories.json, enriches each story with viewpoint data, writes back.
 * Run AFTER fetch-stories.ts in the build pipeline.
 * 
 * Prompt design based on Skip's sentiment analysis template.
 */

import * as fs from 'fs';
import * as path from 'path';

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const MODEL = 'grok-3-mini-fast';
const DELAY_MS = 2000; // Delay between requests to avoid rate limits

interface GrokViewpointWithTweets {
  lean: 'right' | 'center' | 'left';
  summary: string;
  sentiment_score: number; // -1 (very negative) to 0 (neutral) to +1 (very positive)
  tweets: {
    author_handle: string;
    author_name: string;
    quote: string;
    tweet_url?: string;
    is_verified: boolean;
  }[];
}

interface GrokAnalysis {
  viewpoints: GrokViewpointWithTweets[];
  availability_note: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function analyzeStory(
  apiKey: string,
  title: string,
  description: string,
  retries = 2
): Promise<GrokAnalysis | null> {
  const prompt = `Provide a concise sentiment breakdown on the following news story and current X (Twitter) reactions.

News Story: "${title}"
Summary: "${description}"

Structure your response EXACTLY as the following JSON schema. Do NOT deviate.

{
  "viewpoints": [
    {
      "lean": "right",
      "summary": "Short summary paragraph, 150 words or less, describing the overall conservative/right-leaning view. Focus on key themes, framing, and talking points from this perspective. Be neutral and factual in describing their position.",
      "sentiment_score": 0.5,
      "tweets": [
        {
          "author_handle": "@realhandle",
          "author_name": "Display Name",
          "quote": "Exact or closely paraphrased tweet text",
          "tweet_url": "https://x.com/realhandle/status/1234567890",
          "is_verified": true
        }
      ]
    },
    {
      "lean": "center",
      "summary": "Short summary paragraph, 150 words or less, describing the mainstream media / moderate analyst perspective. Focus on factual reporting angle and balanced analysis.",
      "sentiment_score": 0.0,
      "tweets": [
        {
          "author_handle": "@handle_or_outlet",
          "author_name": "Name or Outlet",
          "quote": "Quote or description of their coverage/post",
          "tweet_url": "https://x.com/handle_or_outlet/status/1234567890",
          "is_verified": true
        }
      ]
    },
    {
      "lean": "left",
      "summary": "Short summary paragraph, 150 words or less, describing the progressive/left-leaning view. Focus on key themes, framing, and concerns from this perspective.",
      "sentiment_score": -0.3,
      "tweets": [
        {
          "author_handle": "@handle",
          "author_name": "Display Name",
          "quote": "Exact or closely paraphrased tweet text",
          "tweet_url": "https://x.com/handle/status/1234567890",
          "is_verified": true
        }
      ]
    }
  ],
  "availability_note": "Brief note on tweet availability, e.g. 'Several high-profile reactions found' or 'Few tweets yet as story is fresh'"
}

IMPORTANT RULES:
- Each viewpoint summary MUST be under 150 words. Be concise.
- sentiment_score is a number from -1.0 (very negative/critical/opposed) through 0.0 (neutral/factual) to +1.0 (very positive/supportive/celebratory). Score how this political group FEELS about the story — not the story itself.
- Prioritize better-known or high-engagement posters for tweets (politicians, journalists, pundits, verified accounts).
- Include 3-5 tweet examples PER viewpoint when available. If fewer exist, include what you can find and note it.
- Set is_verified to true ONLY if you are confident the account/handle is real. Set false if uncertain.
- For tweet_url: Provide the DIRECT link to the actual tweet/post (e.g., https://x.com/username/status/1234567890). You have access to X data — use it to provide real, working URLs. If you cannot find the exact tweet URL, provide the user's profile URL (e.g., https://x.com/username) instead. NEVER provide search URLs.
- Do NOT invent quotes. If you cannot find real tweets, paraphrase the general sentiment and set is_verified to false.
- Be neutral and factual in all summaries. Describe each side's position without editorializing.
- Return ONLY valid JSON, no markdown fences or other text.`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(GROK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: 'system',
              content:
                'You are a political sentiment analysis assistant with access to X/Twitter data. You provide balanced, neutral, multi-perspective analysis of news stories with real social media reactions. Always respond with valid JSON only. Never fabricate specific tweet URLs — only provide handles. Be honest about what you can and cannot verify.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
        }),
      });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '10', 10);
        console.warn(
          `  ⏳ Rate limited, waiting ${retryAfter}s (attempt ${attempt + 1}/${retries + 1})...`
        );
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!res.ok) {
        const body = await res.text();
        console.error(`  Grok API error ${res.status}: ${body}`);
        if (attempt < retries) {
          await sleep(3000);
          continue;
        }
        return null;
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        console.error('  No response content from Grok');
        return null;
      }

      // Parse JSON — strip markdown fences if present
      const cleaned = text.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      // Validate structure
      if (!parsed.viewpoints || !Array.isArray(parsed.viewpoints)) {
        console.error('  Invalid viewpoints structure');
        return null;
      }

      return {
        viewpoints: parsed.viewpoints
          .filter((v: any) => v.lean && v.summary && ['left', 'center', 'right'].includes(v.lean))
          .map((v: any) => ({
            lean: v.lean,
            summary: v.summary,
            sentiment_score: typeof v.sentiment_score === 'number' ? Math.max(-1, Math.min(1, v.sentiment_score)) : 0,
            tweets: (v.tweets || []).map((t: any) => ({
              author_handle: t.author_handle || '',
              author_name: t.author_name || t.author || 'Unknown',
              quote: t.quote || t.text || '',
              is_verified: t.is_verified ?? false,
            })),
          })),
        availability_note: parsed.availability_note || '',
      };
    } catch (err: any) {
      console.error(`  Error on attempt ${attempt + 1}: ${err.message}`);
      if (attempt < retries) {
        await sleep(3000);
        continue;
      }
      return null;
    }
  }

  return null;
}

/**
 * Build a direct profile URL as fallback when Grok doesn't provide a tweet URL.
 */
function buildProfileUrl(handle: string): string {
  const cleanHandle = handle.replace('@', '');
  return `https://x.com/${cleanHandle}`;
}

async function main() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.error('ERROR: XAI_API_KEY not set');
    process.exit(1);
  }

  const storiesPath = path.join(process.cwd(), 'public', 'stories.json');
  if (!fs.existsSync(storiesPath)) {
    console.error('ERROR: public/stories.json not found — run fetch-stories.ts first');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(storiesPath, 'utf-8'));
  const stories = data.stories || [];

  if (stories.length === 0) {
    console.log('No stories to analyze');
    process.exit(0);
  }

  console.log(`🔍 Analyzing ${stories.length} stories with Grok...`);

  let viewpointIdCounter = 1;
  let socialPostIdCounter = 1;
  let successCount = 0;

  for (let i = 0; i < stories.length; i++) {
    const story = stories[i];
    console.log(`[${i + 1}/${stories.length}] ${story.title.substring(0, 60)}...`);

    const analysis = await analyzeStory(apiKey, story.title, story.description || '');

    if (analysis && analysis.viewpoints.length > 0) {
      story.viewpoints = analysis.viewpoints.map((vp) => {
        const vpId = viewpointIdCounter++;

        const posts = vp.tweets.map((t) => ({
          id: socialPostIdCounter++,
          viewpoint_id: vpId,
          author: t.author_name,
          author_handle: t.author_handle,
          text: t.quote,
          url: t.tweet_url && t.tweet_url.includes('x.com/')
            ? t.tweet_url
            : buildProfileUrl(t.author_handle),
          platform: 'X',
          is_verified: t.is_verified,
          likes: 0,
          retweets: 0,
          created_at: new Date().toISOString(),
        }));

        return {
          id: vpId,
          story_id: story.id,
          lean: vp.lean,
          summary: vp.summary,
          sentiment_score: vp.sentiment_score,
          availability_note: analysis.availability_note,
          created_at: new Date().toISOString(),
          social_posts: posts,
        };
      });

      const totalTweets = analysis.viewpoints.reduce((a, v) => a + v.tweets.length, 0);
      successCount++;
      console.log(`  ✅ ${analysis.viewpoints.length} viewpoints, ${totalTweets} tweets`);
      if (analysis.availability_note) {
        console.log(`  📝 ${analysis.availability_note}`);
      }
    } else {
      console.log('  ⚠️ No viewpoints returned, keeping empty');
      story.viewpoints = [];
    }

    // Save incrementally after each story (prevents data loss on crash)
    data.analyzed_at = new Date().toISOString();
    fs.writeFileSync(storiesPath, JSON.stringify(data, null, 2));

    // Rate limit delay between requests
    if (i < stories.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n✅ Analysis complete: ${successCount}/${stories.length} stories enriched`);
}

main().catch((e) => {
  console.error('⚠️ Viewpoint analysis failed:', e.message);

  const storiesPath = path.join(process.cwd(), 'public', 'stories.json');
  if (fs.existsSync(storiesPath)) {
    console.log('✅ stories.json preserved (partial data may exist)');
    process.exit(0);
  } else {
    process.exit(1);
  }
});
