/**
 * Build-time script: Fetches stories AND viewpoints with proper tweet URLs from Gemini
 * Writes to public/stories.json with complete viewpoint analysis
 */

import * as fs from 'fs';
import * as path from 'path';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const CATEGORIES = ['politics', 'crime', 'us', 'international', 'science_tech', 'sports', 'health', 'business', 'entertainment', 'environment'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  politics: 'Politics',
  crime: 'Crime', 
  us: 'US',
  international: 'International',
  science_tech: 'Science & Technology',
  sports: 'Sports',
  health: 'Health',
  business: 'Business',
  entertainment: 'Entertainment',
  environment: 'Environment',
};

const STORIES_PER_CATEGORY = 5;

async function queryGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY not set');

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
      },
      tools: [{ google_search: {} }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response from Gemini');
  return text;
}

async function fetchStories() {
  console.log('🔍 Phase 1: Fetching stories...');

  const today = new Date().toISOString().split('T')[0];
  const prompt = `You are a news aggregation service. Today's date is ${today}.

Return the top ${STORIES_PER_CATEGORY} current news stories for EACH of these categories: ${Object.values(CATEGORY_LABELS).join(', ')}.

IMPORTANT: Only include stories published within the LAST 12-24 HOURS. Use Google Search to find the most recent, breaking news stories.

For each story, provide:
- title: The exact headline as published
- description: A 2-3 sentence summary
- url: The actual URL to the news article (real, working link to major news outlet)
- image_url: Direct URL to article's main image (og:image). Must be .jpg/.png/.webp URL or null.
- source: News outlet name (e.g., CNN, BBC, Reuters, NYT)
- category: One of: ${CATEGORIES.join(', ')}
- published_at: ISO 8601 format with time (e.g., "${today}T14:30:00Z")

Return JSON array of ${STORIES_PER_CATEGORY * CATEGORIES.length} story objects.

JSON schema:
[{
  "title": "string",
  "description": "string",
  "url": "string",
  "image_url": "string | null",
  "source": "string",
  "category": "politics|crime|us|international|science_tech|sports|health|business|entertainment|environment",
  "published_at": "ISO 8601 string"
}]

Return ONLY the JSON array, no other text.`;

  const text = await queryGemini(prompt);
  
  let stories;
  try {
    const parsed = JSON.parse(text);
    stories = Array.isArray(parsed) ? parsed : parsed.stories || parsed.articles || [];
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      stories = JSON.parse(match[0]);
    } else {
      throw new Error('Could not parse stories response');
    }
  }

  const seenUrls = new Set<string>();
  return stories
    .filter((s: any) => {
      if (!s.title || !s.url) return false;
      if (seenUrls.has(s.url)) return false;
      seenUrls.add(s.url);
      return CATEGORIES.includes(s.category);
    })
    .map((s: any, i: number) => ({
      id: i + 1,
      title: s.title,
      description: s.description || '',
      url: s.url,
      source: s.source || 'Unknown',
      image_url: s.image_url || null,
      category: s.category,
      published_at: s.published_at || new Date().toISOString(),
      created_at: new Date().toISOString(),
    }));
}

async function fetchViewpoints(story: any) {
  console.log(`  🔄 Analyzing viewpoints for: ${story.title.substring(0, 60)}...`);

  const prompt = `You are a political sentiment analyst. Analyze this news story from left, center, and right-leaning perspectives.

Story: "${story.title}"
Description: ${story.description}
URL: ${story.url}

For EACH perspective (left, center, right), provide:

1. A summary (2-3 sentences) of how that political leaning views this story
2. Find 2-3 REAL tweets from verified accounts on 𝕏 (Twitter) that represent that viewpoint
   - CRITICAL: You MUST provide COMPLETE tweet URLs including the status ID
   - Format: https://x.com/[username]/status/[tweetID]
   - Example: https://x.com/cnnbrk/status/1234567890123456789
   - DO NOT use profile URLs like https://x.com/username
   - Find actual, recent tweets about this story

Return JSON with this EXACT schema:

{
  "left": {
    "summary": "string",
    "tweets": [
      {
        "author": "Display Name",
        "author_handle": "@username",
        "text": "Tweet text content",
        "url": "https://x.com/username/status/1234567890",
        "verified": true/false,
        "likes": number,
        "retweets": number
      }
    ]
  },
  "center": { ... same structure ... },
  "right": { ... same structure ... }
}

IMPORTANT: 
- Each tweet URL MUST include /status/[ID]
- Find real, recent tweets about this story
- If you cannot find real tweets, use "availability_note": "Limited social media coverage" and provide empty tweets array

Return ONLY the JSON object, no other text.`;

  try {
    const text = await queryGemini(prompt);
    
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        data = JSON.parse(match[0]);
      } else {
        throw new Error('Could not parse viewpoints response');
      }
    }

    const viewpoints = [];
    
    for (const lean of ['left', 'center', 'right'] as const) {
      const vp = data[lean];
      if (vp && vp.summary) {
        viewpoints.push({
          lean,
          summary: vp.summary,
          availability_note: vp.availability_note || null,
          social_posts: (vp.tweets || []).map((t: any) => ({
            author: t.author,
            author_handle: t.author_handle,
            text: t.text,
            url: t.url,
            platform: 'twitter',
            is_verified: t.verified || false,
            likes: t.likes || 0,
            retweets: t.retweets || 0,
          })),
        });
      }
    }

    return viewpoints;
  } catch (error) {
    console.error(`    ⚠️ Failed to fetch viewpoints: ${error instanceof Error ? error.message : error}`);
    return [];
  }
}

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('ERROR: GOOGLE_API_KEY not set');
    process.exit(1);
  }

  try {
    // Phase 1: Fetch stories
    const stories = await fetchStories();
    console.log(`✅ Fetched ${stories.length} stories`);

    // Phase 2: Fetch viewpoints for each story (with delay to avoid rate limits)
    console.log('🔍 Phase 2: Analyzing viewpoints...');
    const storiesWithViewpoints = [];

    for (let i = 0; i < stories.length; i++) {
      const story = stories[i];
      const viewpoints = await fetchViewpoints(story);
      
      storiesWithViewpoints.push({
        ...story,
        viewpoints,
      });

      // Delay between requests to avoid rate limiting
      if (i < stories.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
      }
    }

    const output = {
      stories: storiesWithViewpoints,
      fetched_at: new Date().toISOString(),
      count: storiesWithViewpoints.length,
    };

    // Write to public directory
    const outPath = path.join(process.cwd(), 'public', 'stories.json');
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

    console.log(`✅ Wrote ${storiesWithViewpoints.length} stories with viewpoints to public/stories.json`);
    
    // Print summary
    const cats: Record<string, number> = {};
    storiesWithViewpoints.forEach((s: any) => cats[s.category] = (cats[s.category] || 0) + 1);
    console.log('Categories:', JSON.stringify(cats));
    
    const viewpointCount = storiesWithViewpoints.reduce((sum, s) => sum + s.viewpoints.length, 0);
    console.log(`Viewpoints: ${viewpointCount} total`);

  } catch (error) {
    console.error('⚠️ Fetch failed:', error instanceof Error ? error.message : error);
    
    // Check for fallback
    const existingPath = path.join(process.cwd(), 'public', 'stories.json');
    if (fs.existsSync(existingPath)) {
      const data = JSON.parse(fs.readFileSync(existingPath, 'utf-8'));
      console.log(`✅ Using existing stories.json as fallback (${data.count || 0} stories)`);
      process.exit(0);
    } else {
      console.error('❌ No fallback available');
      process.exit(1);
    }
  }
}

main();
