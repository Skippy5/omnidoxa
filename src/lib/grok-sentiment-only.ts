/**
 * Grok Sentiment Analysis (No Twitter API)
 * Generates plausible tweet examples based on article analysis
 */

import type { StoryWithViewpoints, ViewpointWithPosts, SocialPost } from './types';
import type { NewsdataArticle } from './newsdata';

interface SentimentAnalysis {
  nonBiasedSummary: string;
  left: {
    summary: string;
    sentiment: number;
    tweets: Array<{ account: string; text: string }>;
  };
  center: {
    summary: string;
    sentiment: number;
    tweets: Array<{ account: string; text: string }>;
  };
  right: {
    summary: string;
    sentiment: number;
    tweets: Array<{ account: string; text: string }>;
  };
}

/**
 * Analyze sentiment using Grok with example tweet generation
 */
async function analyzeSentimentWithExamples(article: NewsdataArticle): Promise<SentimentAnalysis> {
  const apiKey = process.env.XAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('XAI_API_KEY not configured');
  }

  const prompt = `Analyze political sentiment for this article from left, center, and right perspectives:

**Title:** ${article.title}
**Description:** ${article.description || 'N/A'}
**Source:** ${article.source_name}

Provide:
1. Non-biased summary (2-3 sentences)
2. For each perspective (left, center, right):
   - Sentiment score from -1 (very negative) to +1 (very positive)
   - Summary of how that perspective views this (2-3 sentences)
   - 3 plausible example tweets that represent this viewpoint

Return ONLY valid JSON:
{
  "nonBiasedSummary": "...",
  "left": {
    "sentiment": 0.5,
    "summary": "...",
    "tweets": [
      {"account": "@username", "text": "tweet text"},
      {"account": "@username2", "text": "tweet text"},
      {"account": "@username3", "text": "tweet text"}
    ]
  },
  "center": {
    "sentiment": 0.0,
    "summary": "...",
    "tweets": [...]
  },
  "right": {
    "sentiment": -0.3,
    "summary": "...",
    "tweets": [...]
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
        model: 'grok-4',
        messages: [
          {
            role: 'system',
            content: 'You are a political analyst. Generate realistic, plausible example tweets that represent each perspective. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Grok API error: ${JSON.stringify(data)}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in Grok response');
    }

    // Extract JSON from response
    const jsonMatch = content.match(/```json\n([\s\S]+?)\n```/) || content.match(/(\{[\s\S]+\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    return {
      nonBiasedSummary: article.description || article.title,
      left: { summary: 'Analysis unavailable', sentiment: 0, tweets: [] },
      center: { summary: 'Analysis unavailable', sentiment: 0, tweets: [] },
      right: { summary: 'Analysis unavailable', sentiment: 0, tweets: [] }
    };
  }
}

/**
 * Convert article to Story with Grok sentiment analysis
 */
export async function convertToStoryWithGrokOnly(
  article: NewsdataArticle,
  storyId: number,
  intendedCategory?: string
): Promise<StoryWithViewpoints> {
  
  console.log(`  🤖 Analyzing with Grok: ${article.title.substring(0, 50)}...`);
  
  const analysis = await analyzeSentimentWithExamples(article);
  
  console.log(`  📊 Sentiment: L:${analysis.left.sentiment.toFixed(1)} C:${analysis.center.sentiment.toFixed(1)} R:${analysis.right.sentiment.toFixed(1)}`);
  console.log(`  💬 Example tweets generated: ${analysis.left.tweets.length + analysis.center.tweets.length + analysis.right.tweets.length}`);
  
  // Convert tweets to SocialPost format
  const convertTweets = (tweets: Array<{ account: string; text: string }>, lean: 'left' | 'center' | 'right'): SocialPost[] => {
    const offset = lean === 'left' ? 0 : lean === 'center' ? 3 : 6;
    return tweets.map((tweet, idx) => ({
      id: (storyId * 9) + offset + idx,
      viewpoint_id: storyId * 3 + (lean === 'left' ? 0 : lean === 'center' ? 1 : 2),
      author: tweet.account.replace('@', ''),
      author_handle: tweet.account.startsWith('@') ? tweet.account : `@${tweet.account}`,
      text: tweet.text,
      url: '#', // Placeholder - these are example tweets
      platform: 'twitter',
      likes: 0,
      retweets: 0,
      is_real: false,  // synthetic/example posts
      post_date: null,
      created_at: new Date().toISOString()
    }));
  };

  const createViewpoint = (lean: 'left' | 'center' | 'right', data: typeof analysis.left): ViewpointWithPosts => {
    return {
      id: storyId * 3 + (lean === 'left' ? 0 : lean === 'center' ? 1 : 2),
      story_id: storyId,
      lean,
      summary: data.summary,
      sentiment_score: data.sentiment,
      social_posts: convertTweets(data.tweets, lean),
      created_at: new Date().toISOString()
    };
  };

  const ensureValidCategory = (cat: string): 'breaking' | 'business' | 'crime' | 'entertainment' | 'politics' | 'science' | 'top' | 'world' => {
    const validCategories = ['breaking', 'business', 'crime', 'entertainment', 'politics', 'science', 'top', 'world'] as const;
    return validCategories.includes(cat as any) ? cat as any : 'top';
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
