/**
 * Build-time script: Analyzes stories with Grok (xAI) for L/C/R viewpoints.
 * Reads public/stories.json, enriches each story with viewpoint data, writes back.
 * Run AFTER fetch-stories.ts in the build pipeline.
 */

import * as fs from 'fs';
import * as path from 'path';

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const MODEL = 'grok-3-mini-fast';
const DELAY_MS = 1500; // Delay between requests to avoid rate limits

interface GrokViewpoint {
  lean: 'left' | 'center' | 'right';
  summary: string;
}

interface GrokSocialPost {
  author: string;
  author_handle: string;
  text: string;
  url: string;
  platform: string;
}

interface GrokAnalysis {
  viewpoints: GrokViewpoint[];
  social_posts: GrokSocialPost[];
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
  const prompt = `Analyze the following news story from multiple political perspectives.

Story: "${title}"
Summary: "${description}"

Provide:
1. A LEFT-leaning perspective summary (2-3 sentences) — how progressives/liberals would frame this story
2. A CENTER perspective summary (2-3 sentences) — a balanced, neutral take on the facts
3. A RIGHT-leaning perspective summary (2-3 sentences) — how conservatives would frame this story
4. 2-3 social media posts/discussions about this story (X/Twitter preferred). For each post provide the author name, handle, post text, and URL.

Return ONLY valid JSON matching this schema:
{
  "viewpoints": [
    { "lean": "left", "summary": "..." },
    { "lean": "center", "summary": "..." },
    { "lean": "right", "summary": "..." }
  ],
  "social_posts": [
    {
      "author": "Display Name",
      "author_handle": "@handle",
      "text": "Post text...",
      "url": "https://x.com/...",
      "platform": "X"
    }
  ]
}`;

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
                'You are a political analysis assistant. You provide balanced multi-perspective analysis of news stories. Always respond with valid JSON only, no markdown fences.',
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
        viewpoints: parsed.viewpoints.filter(
          (v: any) => v.lean && v.summary && ['left', 'center', 'right'].includes(v.lean)
        ),
        social_posts: (parsed.social_posts || []).map((p: any) => ({
          author: p.author || 'Unknown',
          author_handle: p.author_handle || '',
          text: p.text || '',
          url: p.url || '',
          platform: p.platform || 'X',
        })),
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
      // Distribute social posts across viewpoints (round-robin)
      const socialByLean: Record<string, any[]> = { left: [], center: [], right: [] };
      (analysis.social_posts || []).forEach((post, idx) => {
        const leans = ['left', 'center', 'right'];
        socialByLean[leans[idx % 3]].push(post);
      });

      story.viewpoints = analysis.viewpoints.map((vp) => {
        const vpId = viewpointIdCounter++;
        const posts = (socialByLean[vp.lean] || []).map((p) => ({
          id: socialPostIdCounter++,
          viewpoint_id: vpId,
          author: p.author,
          author_handle: p.author_handle,
          text: p.text,
          url: p.url,
          platform: p.platform,
          likes: 0,
          retweets: 0,
          created_at: new Date().toISOString(),
        }));

        return {
          id: vpId,
          story_id: story.id,
          lean: vp.lean,
          summary: vp.summary,
          created_at: new Date().toISOString(),
          social_posts: posts,
        };
      });

      successCount++;
      console.log(`  ✅ Got ${analysis.viewpoints.length} viewpoints, ${analysis.social_posts.length} social posts`);
    } else {
      console.log('  ⚠️ No viewpoints returned, keeping empty');
      story.viewpoints = [];
    }

    // Rate limit delay between requests
    if (i < stories.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // Write enriched data back
  data.analyzed_at = new Date().toISOString();
  fs.writeFileSync(storiesPath, JSON.stringify(data, null, 2));

  console.log(`\n✅ Analysis complete: ${successCount}/${stories.length} stories enriched with viewpoints`);
}

main().catch((e) => {
  console.error('⚠️ Viewpoint analysis failed:', e.message);

  // Don't fail the build — stories without viewpoints still work
  const storiesPath = path.join(process.cwd(), 'public', 'stories.json');
  if (fs.existsSync(storiesPath)) {
    console.log('✅ stories.json preserved without viewpoint data');
    process.exit(0);
  } else {
    process.exit(1);
  }
});
