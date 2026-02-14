/**
 * Twitter + Grok Sentiment Analysis
 * Uses Twitter API v2 for real tweets + Grok for sentiment scoring
 */

import type { StoryWithViewpoints, ViewpointWithPosts, SocialPost } from './types';
import type { NewsdataArticle } from './newsdata';
import { searchArticleTweets, distributeTweets, type TweetData } from './twitter-api';

interface SentimentAnalysis {
  nonBiasedSummary: string;
  left: {
    summary: string;
    sentiment: number;
  };
  center: {
    summary: string;
    sentiment: number;
  };
  right: {
    summary: string;
    sentiment: number;
  };
}

/**
 * Analyze sentiment using Grok (fast, no x_search)
 */
async function analyzeSentiment(
  article: NewsdataArticle,
  tweets: { left: TweetData[]; center: TweetData[]; right: TweetData[] }
): Promise<SentimentAnalysis> {
  const apiKey = process.env.XAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('XAI_API_KEY not configured');
  }

  const prompt = `Analyze political sentiment for this article based on these real tweets:

**Article:** ${article.title}
**Description:** ${article.description || 'N/A'}

**Left-leaning tweets:**
${tweets.left.map((t, i) => `${i + 1}. ${t.handle}: ${t.text}`).join('\n')}

**Center tweets:**
${tweets.center.map((t, i) => `${i + 1}. ${t.handle}: ${t.text}`).join('\n')}

**Right-leaning tweets:**
${tweets.right.map((t, i) => `${i + 1}. ${t.handle}: ${t.text}`).join('\n')}

Provide:
1. Non-biased summary (2-3 sentences)
2. For each perspective (left, center, right):
   - Sentiment score from -1 (negative) to +1 (positive)
   - Summary of how that perspective views this topic (2-3 sentences)

Return ONLY valid JSON:
{
  "nonBiasedSummary": "...",
  "left": {
    "summary": "...",
    "sentiment": 0.5
  },
  "center": {
    "summary": "...",
    "sentiment": 0.0
  },
  "right": {
    "summary": "...",
    "sentiment": -0.3
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
            content: 'You are a political analyst. Analyze sentiment accurately. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
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
      left: { summary: 'Analysis unavailable', sentiment: 0 },
      center: { summary: 'Analysis unavailable', sentiment: 0 },
      right: { summary: 'Analysis unavailable', sentiment: 0 }
    };
  }
}

/**
 * Convert article to Story with Twitter sentiment analysis
 */
export async function convertToStoryWithTwitter(
  article: NewsdataArticle,
  storyId: number,
  intendedCategory?: string
): Promise<StoryWithViewpoints> {
  
  console.log(`  🐦 Searching Twitter for: ${article.title.substring(0, 50)}...`);
  
  // Search Twitter for real tweets (fast - 2-5 seconds)
  const allTweets = await searchArticleTweets(article);
  
  console.log(`  ✅ Found ${allTweets.length} tweets`);
  
  // Distribute tweets across perspectives
  const distributedTweets = distributeTweets(allTweets);
  
  console.log(`  📊 Distributed: L:${distributedTweets.left.length} C:${distributedTweets.center.length} R:${distributedTweets.right.length}`);
  
  // Analyze sentiment with Grok (fast - 3-5 seconds)
  console.log(`  🤖 Analyzing sentiment with Grok...`);
  const sentiment = await analyzeSentiment(article, distributedTweets);
  
  // Convert tweets to SocialPost format
  const convertTweets = (tweets: TweetData[], lean: 'left' | 'center' | 'right'): SocialPost[] => {
    const offset = lean === 'left' ? 0 : lean === 'center' ? 3 : 6;
    return tweets.map((tweet, idx) => ({
      id: (storyId * 9) + offset + idx,
      viewpoint_id: storyId * 3 + (lean === 'left' ? 0 : lean === 'center' ? 1 : 2),
      author: tweet.author,
      content: tweet.text,
      url: tweet.url,
      platform: 'twitter',
      created_at: new Date().toISOString()
    }));
  };

  const createViewpoint = (lean: 'left' | 'center' | 'right', data: typeof sentiment.left, tweets: TweetData[]): ViewpointWithPosts => {
    return {
      id: storyId * 3 + (lean === 'left' ? 0 : lean === 'center' ? 1 : 2),
      story_id: storyId,
      lean,
      summary: data.summary,
      sentiment_score: data.sentiment,
      social_posts: convertTweets(tweets, lean),
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
    description: sentiment.nonBiasedSummary,
    url: article.link,
    source: article.source_name,
    image_url: article.image_url,
    category: ensureValidCategory(category),
    published_at: article.pubDate,
    fetched_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    viewpoints: [
      createViewpoint('left', sentiment.left, distributedTweets.left),
      createViewpoint('center', sentiment.center, distributedTweets.center),
      createViewpoint('right', sentiment.right, distributedTweets.right)
    ]
  };
}
