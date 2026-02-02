import { GOOGLE_API_KEY, CATEGORY_LIST, CATEGORIES } from './config';
import type { Category, Story } from './types';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const STORIES_PER_CATEGORY = 2;

interface GeminiStory {
  title: string;
  description: string;
  url: string;
  source: string;
  image_url: string | null;
  category: string;
  published_at: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

async function queryGemini(prompt: string): Promise<string> {
  const res = await fetch(`${GEMINI_API_URL}?key=${GOOGLE_API_KEY}`, {
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
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  const data: GeminiResponse = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response from Gemini');
  return text;
}

export async function fetchAllStories(): Promise<Omit<Story, 'id' | 'created_at'>[]> {
  if (!GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is not configured');
  }

  const categoryLabels = CATEGORY_LIST.map(c => CATEGORIES[c].label);
  
  const prompt = `You are a news aggregation service. Return the top ${STORIES_PER_CATEGORY} current news stories for EACH of these categories: ${categoryLabels.join(', ')}.

For each story, provide:
- title: The headline
- description: A 1-2 sentence summary
- url: The actual URL to the news article (must be a real, working link)
- source: The news outlet name
- image_url: null (we'll fetch images later)
- category: One of: ${CATEGORY_LIST.join(', ')}
- published_at: The approximate publication date/time in ISO 8601 format

Return a JSON array of exactly ${STORIES_PER_CATEGORY * CATEGORY_LIST.length} story objects. Focus on the most significant, widely-reported stories from the last 24 hours. Ensure URLs are real and point to actual articles.

JSON schema for each object:
{
  "title": "string",
  "description": "string", 
  "url": "string",
  "source": "string",
  "image_url": null,
  "category": "string",
  "published_at": "string"
}

Return ONLY the JSON array, no other text.`;

  const responseText = await queryGemini(prompt);
  
  let stories: GeminiStory[];
  try {
    const parsed = JSON.parse(responseText);
    stories = Array.isArray(parsed) ? parsed : parsed.stories || parsed.articles || [];
  } catch {
    // Try to extract JSON array from the response
    const match = responseText.match(/\[[\s\S]*\]/);
    if (match) {
      stories = JSON.parse(match[0]);
    } else {
      throw new Error('Could not parse Gemini response as JSON');
    }
  }

  const now = new Date().toISOString();
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();

  return stories
    .filter(s => {
      if (!s.title || !s.url) return false;
      if (seenUrls.has(s.url)) return false;
      const normalizedTitle = s.title.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seenTitles.has(normalizedTitle)) return false;
      seenUrls.add(s.url);
      seenTitles.add(normalizedTitle);
      return true;
    })
    .map(s => ({
      title: s.title,
      description: s.description || '',
      url: s.url,
      source: s.source || 'Unknown',
      image_url: s.image_url || null,
      category: (CATEGORY_LIST.includes(s.category as Category) ? s.category : 'us') as Category,
      published_at: s.published_at || now,
      fetched_at: now,
    }));
}
