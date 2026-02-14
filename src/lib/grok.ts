/**
 * xAI Grok API Integration
 * - Movies for Athens OH
 * - Local news for Athens OH, Marietta OH, Parkersburg WV
 * - Sentiment analysis for articles
 */

export interface Movie {
  title: string;
  releaseDate: string;
  trailerLink: string | null;
  status: 'current' | 'upcoming';
}

export interface NewsStory {
  headline: string;
  link: string;
  summary: string; // 1-2 sentences
}

export interface GrokNewsCategories {
  celebrity: NewsStory[];
  legal: NewsStory[];
  topUS: NewsStory[];
  athensOH: NewsStory[];
  mariettaOH: NewsStory[];
  parkersburgWV: NewsStory[];
}

export interface GrokData {
  movies: Movie[];
  news: GrokNewsCategories;
}

export interface SentimentResult {
  score: number; // -1 to 1
  label: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

/**
 * Fetch movies and local news from xAI Grok
 */
export async function fetchGrokData(): Promise<GrokData> {
  const apiKey = process.env.XAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('XAI_API_KEY not configured');
  }

  const prompt = `Please provide the following information in JSON format:

1. Current and upcoming movies showing in Athens, OH
   - Include: title, release date, trailer link (if available)
   - Separate into "current" (now showing) and "upcoming" (coming soon)

2. Top 5 news stories in each category (with headline, link, 1-2 sentence summary):
   - Celebrity/Entertainment
   - Legal (major court case updates)
   - Top US News
   - Athens OH local news
   - Marietta OH local news
   - Parkersburg WV local news

Return ONLY valid JSON in this exact format:
{
  "movies": [
    { "title": "...", "releaseDate": "YYYY-MM-DD", "trailerLink": "...", "status": "current" or "upcoming" }
  ],
  "news": {
    "celebrity": [{ "headline": "...", "link": "...", "summary": "..." }],
    "legal": [...],
    "topUS": [...],
    "athensOH": [...],
    "mariettaOH": [...],
    "parkersburgWV": [...]
  }
}`;

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that provides accurate, current information about movies and news. Always return valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`xAI API error: ${JSON.stringify(data)}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in Grok response');
    }

    // Extract JSON from response (might be wrapped in markdown code blocks)
    const jsonMatch = content.match(/```json\n([\s\S]+?)\n```/) || content.match(/(\{[\s\S]+\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Error fetching Grok data:', error);
    throw error;
  }
}

/**
 * Analyze sentiment of a text using xAI Grok
 */
export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  const apiKey = process.env.XAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('XAI_API_KEY not configured');
  }

  const prompt = `Analyze the sentiment of this text and return ONLY valid JSON with this exact format:
{ "score": <number between -1 and 1>, "label": "positive" or "negative" or "neutral", "confidence": <number between 0 and 1> }

Text to analyze:
${text}`;

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          {
            role: 'system',
            content: 'You are a sentiment analysis expert. Return only valid JSON with sentiment scores.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`xAI API error: ${JSON.stringify(data)}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in Grok response');
    }

    // Extract JSON
    const jsonMatch = content.match(/```json\n([\s\S]+?)\n```/) || content.match(/(\{[\s\S]+\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    // Return neutral sentiment on error
    return { score: 0, label: 'neutral', confidence: 0 };
  }
}

/**
 * Batch analyze sentiment for multiple texts
 * (with rate limiting to avoid API overload)
 */
export async function batchAnalyzeSentiment(
  texts: string[],
  delayMs: number = 500
): Promise<SentimentResult[]> {
  const results: SentimentResult[] = [];

  for (const text of texts) {
    const sentiment = await analyzeSentiment(text);
    results.push(sentiment);
    
    // Rate limiting
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Get cached Grok data from filesystem
 */
export async function getCachedGrokData(): Promise<{
  lastUpdated: string;
  data: GrokData;
} | null> {
  const fs = require('fs');
  const path = require('path');
  const cacheFile = path.join(process.cwd(), 'grok-cache.json');

  try {
    if (!fs.existsSync(cacheFile)) {
      return null;
    }

    const content = fs.readFileSync(cacheFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading Grok cache:', error);
    return null;
  }
}

/**
 * Save Grok data to cache
 */
export async function saveCachedGrokData(data: GrokData): Promise<void> {
  const fs = require('fs');
  const path = require('path');
  const cacheFile = path.join(process.cwd(), 'grok-cache.json');

  const cacheData = {
    lastUpdated: new Date().toISOString(),
    data
  };

  fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
}
