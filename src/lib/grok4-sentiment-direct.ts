/**
 * Grok-4 Sentiment Analysis using /v1/responses API with live_search
 * Direct TypeScript implementation - fetches REAL tweets from X/Twitter
 */

import type { StoryWithViewpoints, ViewpointWithPosts, SocialPost } from './types';
import type { NewsdataArticle } from './newsdata';

const XAI_API_KEY = process.env.XAI_API_KEY || '';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface TweetExample {
  author: string;
  handle: string;
  text: string;
  url: string;
}

interface Grok4Analysis {
  nonBiasedSummary: string;
  left: { sentiment: number; summary: string; tweets: TweetExample[] };
  center: { sentiment: number; summary: string; tweets: TweetExample[] };
  right: { sentiment: number; summary: string; tweets: TweetExample[] };
}

/**
 * Safely parse a Response body as JSON, logging the raw text on failure.
 */
async function safeParseJson(response: Response, context: string): Promise<any> {
  const rawText = await response.text();
  console.log(`  [${context}] Raw response (${rawText.length} chars): ${rawText.slice(0, 500)}`);
  try {
    return JSON.parse(rawText);
  } catch (parseError) {
    throw new Error(
      `Failed to parse ${context} as JSON: ${parseError instanceof Error ? parseError.message : parseError}. ` +
      `Raw response: ${rawText.slice(0, 300)}`
    );
  }
}

function fallbackAnalysis(article: NewsdataArticle): Grok4Analysis {
  const keywords = (article.title + ' ' + (article.description || '')).toLowerCase();
  // Simple keyword-based fallback sentiment when the API is unavailable
  const negativeWords = ['crisis', 'scandal', 'attack', 'war', 'fail', 'crash', 'death', 'threat', 'ban', 'reject'];
  const positiveWords = ['win', 'success', 'growth', 'pass', 'gain', 'boost', 'support', 'agree', 'peace', 'reform'];
  const negCount = negativeWords.filter(w => keywords.includes(w)).length;
  const posCount = positiveWords.filter(w => keywords.includes(w)).length;
  const baseSentiment = Math.max(-1, Math.min(1, (posCount - negCount) * 0.25));

  return {
    nonBiasedSummary: article.description || article.title,
    left: { sentiment: baseSentiment - 0.1, summary: 'Sentiment estimated from article keywords (API unavailable).', tweets: [] },
    center: { sentiment: baseSentiment, summary: 'Sentiment estimated from article keywords (API unavailable).', tweets: [] },
    right: { sentiment: baseSentiment + 0.1, summary: 'Sentiment estimated from article keywords (API unavailable).', tweets: [] }
  };
}

/**
 * Analyze article using xAI Responses API with x_search tool.
 * Retries up to MAX_RETRIES times with exponential backoff.
 */
export async function analyzeWithGrok4Direct(
  article: NewsdataArticle
): Promise<Grok4Analysis> {

  const prompt = `Analyze the sentiment from the political left, right, and center for the following recent news topic: ${article.title}. Base it on this article if provided: ${article.link}

Focus on analysis from the past 30 days only. Provide a 3-sentence non-biased review of the topic.

Then, break it down into left, center, and right: a score from -1 (negative) to 1 (positive), 2-3 sentences on how the group feels about the topic, and three example tweets for each left, right, and center to back up the analysis, including the account name, tweet text, and link to each tweet.

Use live_search to find REAL tweets from X/Twitter. Do not fabricate or invent examples.`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`  🔍 Calling xAI Responses API with live_search (attempt ${attempt}/${MAX_RETRIES})...`);

      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${XAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'grok-4',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant. Always use the live_search tool to fetch real tweets from X instead of generating them. Provide sources and avoid fabrication.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          tools: [
            {
              type: 'live_search',
              sources: ['twitter']
            }
          ],
          max_tokens: 4096,
          temperature: 0
        })
      });

      if (!response.ok) {
        const errorData = await safeParseJson(response, `xAI error ${response.status}`);
        throw new Error(`xAI API HTTP ${response.status}: ${JSON.stringify(errorData)}`);
      }

      const data = await safeParseJson(response, 'xAI response');
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error(`No content in xAI response. Full payload: ${JSON.stringify(data).slice(0, 300)}`);
      }

      console.log(`  ✅ Got response from xAI (attempt ${attempt})`);
      return parseGrok4Response(content, article);

    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ xAI attempt ${attempt}/${MAX_RETRIES} failed: ${errorMsg}`);

      if (isLastAttempt) {
        console.error('  ⚠️ All retries exhausted, using fallback sentiment scoring');
        return fallbackAnalysis(article);
      }

      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`  ⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Unreachable, but satisfies TypeScript
  return fallbackAnalysis(article);
}

function parseGrok4Response(content: string, article: NewsdataArticle): Grok4Analysis {
  const result: Grok4Analysis = {
    nonBiasedSummary: article.description || article.title,
    left: { sentiment: 0, summary: '', tweets: [] },
    center: { sentiment: 0, summary: '', tweets: [] },
    right: { sentiment: 0, summary: '', tweets: [] }
  };

  // Extract non-biased summary
  const summaryMatch = content.match(/###\s*Non-Biased Review[^\n]*\n([\s\S]+?)(?=###|$)/i);
  if (summaryMatch) {
    result.nonBiasedSummary = summaryMatch[1].trim();
  }

  // Parse each perspective
  const perspectives = [
    { key: 'left' as const, regex: /###\s*Left[^\n]*\n\*\*Score:\*\*\s*([-\d.]+)[^\n]*\n([\s\S]+?)(?=\*\*Example Tweets:\*\*|###|$)/i },
    { key: 'center' as const, regex: /###\s*Center[^\n]*\n\*\*Score:\*\*\s*([-\d.]+)[^\n]*\n([\s\S]+?)(?=\*\*Example Tweets:\*\*|###|$)/i },
    { key: 'right' as const, regex: /###\s*Right[^\n]*\n\*\*Score:\*\*\s*([-\d.]+)[^\n]*\n([\s\S]+?)(?=\*\*Example Tweets:\*\*|###|$)/i }
  ];

  for (const { key, regex } of perspectives) {
    const match = content.match(regex);
    if (match) {
      result[key].sentiment = parseFloat(match[1]);
      result[key].summary = match[2].trim();
    }

    // Extract tweets for this perspective
    const sectionRegex = new RegExp(`###\\s*${key === 'left' ? 'Left' : key === 'center' ? 'Center' : 'Right'}[^]*?\\*\\*Example Tweets:\\*\\*([^]*?)(?=###|$)`, 'i');
    const sectionMatch = content.match(sectionRegex);
    
    if (sectionMatch) {
      const tweetsText = sectionMatch[1];
      const tweetPattern = /\d+\.\s+\*\*Account:\*\*\s*([^\n]+)\s+\*\*Tweet Text:\*\*\s*([^\n]+)\s+\*\*Link:\*\*\s*(https?:\/\/[^\s]+)/g;
      
      let tweetMatch;
      while ((tweetMatch = tweetPattern.exec(tweetsText)) !== null) {
        const account = tweetMatch[1].trim();
        const handle = account.startsWith('@') ? account : `@${account.split('(')[0].trim()}`;
        
        result[key].tweets.push({
          author: account,
          handle: handle,
          text: tweetMatch[2].trim().replace(/^"|"$/g, ''),
          url: tweetMatch[3].trim()
        });
      }
    }
  }

  const totalTweets = result.left.tweets.length + result.center.tweets.length + result.right.tweets.length;
  console.log(`  📊 Parsed: ${totalTweets} tweets (L:${result.left.tweets.length} C:${result.center.tweets.length} R:${result.right.tweets.length})`);

  return result;
}

function ensureValidCategory(cat: string): 'technology' | 'domestic' | 'business' | 'crime' | 'entertainment' | 'politics' | 'science' | 'world' {
  const validCategories = ['technology', 'domestic', 'business', 'crime', 'entertainment', 'politics', 'science', 'world'] as const;
  return validCategories.includes(cat as any) ? cat as any : 'world';
}

export async function convertToStoryWithGrok4Direct(
  article: NewsdataArticle,
  storyId: number,
  intendedCategory?: string
): Promise<StoryWithViewpoints> {
  // PHASE 1: Skip xAI sentiment analysis, use fallback only
  const analysis = fallbackAnalysis(article);
  
  const convertTweets = (tweets: TweetExample[]): SocialPost[] => {
    return tweets.map((tweet, idx) => ({
      id: storyId * 100 + idx,
      viewpoint_id: 0,
      author: tweet.author,
      author_handle: tweet.author.toLowerCase().replace(/\s+/g, ''),
      text: tweet.text,
      url: tweet.url,
      platform: 'twitter',
      likes: 0,
      retweets: 0,
      created_at: new Date().toISOString()
    }));
  };

  const createViewpoint = (lean: 'left' | 'center' | 'right', data: typeof analysis.left): ViewpointWithPosts => {
    const viewpointId = storyId * 3 + (lean === 'left' ? 0 : lean === 'center' ? 1 : 2);
    const socialPosts = convertTweets(data.tweets);
    socialPosts.forEach(post => { post.viewpoint_id = viewpointId; });
    
    return {
      id: viewpointId,
      story_id: storyId,
      lean,
      summary: data.summary,
      sentiment_score: data.sentiment,
      social_posts: socialPosts,
      created_at: new Date().toISOString()
    };
  };

  const category = intendedCategory || article.category[0] || 'top';

  return {
    id: storyId,
    title: article.title,
    description: analysis.nonBiasedSummary,
    url: article.link,
    source: article.source_name,
    image_url: article.image_url,
    category: ensureValidCategory(category),
    published_at: article.pubDate,
    fetched_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    viewpoints: [
      createViewpoint('left', analysis.left),
      createViewpoint('center', analysis.center),
      createViewpoint('right', analysis.right)
    ]
  };
}
