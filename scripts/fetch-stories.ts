/**
 * Build-time script: Fetches stories from Gemini and writes to public/stories.json
 * Run this before `next build` or via GitHub Actions on a schedule.
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const CATEGORIES = ['politics', 'crime', 'us', 'international', 'science_tech'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  politics: 'Politics',
  crime: 'Crime', 
  us: 'US',
  international: 'International',
  science_tech: 'Science & Technology',
};

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('ERROR: GOOGLE_API_KEY not set');
    process.exit(1);
  }

  console.log('🔍 Fetching stories from Gemini...');

  const prompt = `You are a news aggregation service. Return the top 2 current news stories for EACH of these categories: ${Object.values(CATEGORY_LABELS).join(', ')}.

For each story, provide:
- title: The headline
- description: A 2-3 sentence summary of the story
- url: The actual URL to the news article (must be a real, working link to a major news outlet)
- source: The news outlet name (e.g., CNN, BBC, Reuters, AP News, NYT)
- category: One of: ${CATEGORIES.join(', ')}
- published_at: The publication date/time in ISO 8601 format

Return a JSON array of exactly 10 story objects. Focus on the most significant, widely-reported stories from the last 24 hours. Ensure URLs are real and point to actual articles from reputable news sources.

JSON schema:
[{
  "title": "string",
  "description": "string",
  "url": "string",
  "source": "string",
  "category": "politics|crime|us|international|science_tech",
  "published_at": "ISO 8601 string"
}]`;

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Gemini API error ${res.status}: ${body}`);
    process.exit(1);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error('No response from Gemini');
    process.exit(1);
  }

  let stories;
  try {
    const parsed = JSON.parse(text);
    stories = Array.isArray(parsed) ? parsed : parsed.stories || parsed.articles || [];
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      stories = JSON.parse(match[0]);
    } else {
      console.error('Could not parse Gemini response');
      process.exit(1);
    }
  }

  // Add IDs and validate
  const seenUrls = new Set<string>();
  const validStories = stories
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
      image_url: null,
      category: s.category,
      published_at: s.published_at || new Date().toISOString(),
      fetched_at: new Date().toISOString(),
      viewpoints: [],
    }));

  const output = {
    stories: validStories,
    fetched_at: new Date().toISOString(),
    count: validStories.length,
  };

  // Write to public directory so it's available as static JSON
  const fs = await import('fs');
  const path = await import('path');
  const outPath = path.join(process.cwd(), 'public', 'stories.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`✅ Wrote ${validStories.length} stories to public/stories.json`);
  
  // Print summary
  const cats: Record<string, number> = {};
  validStories.forEach((s: any) => cats[s.category] = (cats[s.category] || 0) + 1);
  console.log('Categories:', JSON.stringify(cats));
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
