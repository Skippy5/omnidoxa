/**
 * OmniDoxa Analysis Engine
 * Uses xAI Grok to search X.com and analyze political sentiment
 */

import type { StoryWithViewpoints, ViewpointWithPosts, SocialPost, Lean } from './types';
import type { NewsdataArticle } from './newsdata';

interface XSearchResult {
  tweets: {
    author: string;
    handle: string;
    text: string;
    url: string;
    likes: number;
    retweets: number;
  }[];
}

interface PoliticalAnalysis {
  left: {
    summary: string;
    sentiment: number; // -1 to +1
    tweets: SocialPost[];
  };
  center: {
    summary: string;
    sentiment: number;
    tweets: SocialPost[];
  };
  right: {
    summary: string;
    sentiment: number;
    tweets: SocialPost[];
  };
  nonBiasedSummary: string;
}

/**
 * Search X.com for tweets about an article using Grok
 */
async function searchXForArticle(article: NewsdataArticle): Promise<XSearchResult> {
  const apiKey = process.env.XAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('XAI_API_KEY not configured');
  }

  const prompt = `Search X.com (Twitter) for recent tweets discussing this article:

Title: ${article.title}
Description: ${article.description || 'N/A'}
Link: ${article.link}

Find tweets from LEFT, CENTER, and RIGHT political perspectives. Return at least 9 tweets (3 from each perspective).

Return ONLY valid JSON in this format:
{
  "tweets": [
    {
      "author": "Full Name",
      "handle": "@username",
      "text": "Tweet text...",
      "url": "https://twitter.com/username/status/123",
      "likes": 100,
      "retweets": 50
    }
  ]
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
            content: 'You are a social media researcher with access to X.com. Return only valid JSON with real tweet data.'
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

    const jsonMatch = content.match(/```json\n([\s\S]+?)\n```/) || content.match(/(\{[\s\S]+\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Error searching X.com:', error);
    return { tweets: [] };
  }
}

/**
 * Analyze political sentiment using Grok
 */
async function analyzePoliticalSentiment(
  article: NewsdataArticle,
  tweets: XSearchResult['tweets']
): Promise<PoliticalAnalysis> {
  const apiKey = process.env.XAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('XAI_API_KEY not configured');
  }

  const prompt = `Analyze the political sentiment around this article based on these X.com tweets:

Article: ${article.title}
Description: ${article.description || 'N/A'}

Tweets:
${tweets.map((t, i) => `${i + 1}. @${t.handle}: ${t.text}`).join('\n')}

Provide:
1. Non-biased summary of the article (2-3 sentences)
2. LEFT perspective summary and sentiment score (-1 to +1)
3. CENTER perspective summary and sentiment score (-1 to +1)
4. RIGHT perspective summary and sentiment score (-1 to +1)
5. Assign each tweet to LEFT, CENTER, or RIGHT (3 tweets per perspective)

Return ONLY valid JSON:
{
  "nonBiasedSummary": "...",
  "left": {
    "summary": "What left-leaning people are saying...",
    "sentiment": -0.5,
    "tweetIndices": [0, 1, 2]
  },
  "center": {
    "summary": "What centrists are saying...",
    "sentiment": 0.0,
    "tweetIndices": [3, 4, 5]
  },
  "right": {
    "summary": "What right-leaning people are saying...",
    "sentiment": 0.5,
    "tweetIndices": [6, 7, 8]
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
            content: 'You are a political analyst expert at identifying left/center/right perspectives. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5
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

    const jsonMatch = content.match(/```json\n([\s\S]+?)\n```/) || content.match(/(\{[\s\S]+\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    const analysis = JSON.parse(jsonStr);

    // Convert to SocialPost format
    const convertTweets = (indices: number[]): SocialPost[] => {
      return indices.slice(0, 3).map((idx, i) => {
        const tweet = tweets[idx] || tweets[i] || tweets[0];
        return {
          id: idx,
          viewpoint_id: 0,
          author: tweet?.author || 'Unknown',
          author_handle: tweet?.handle || '@unknown',
          text: tweet?.text || '',
          url: tweet?.url || '#',
          platform: 'x',
          likes: tweet?.likes || 0,
          retweets: tweet?.retweets || 0,
          created_at: new Date().toISOString()
        };
      });
    };

    return {
      nonBiasedSummary: analysis.nonBiasedSummary,
      left: {
        summary: analysis.left.summary,
        sentiment: analysis.left.sentiment,
        tweets: convertTweets(analysis.left.tweetIndices)
      },
      center: {
        summary: analysis.center.summary,
        sentiment: analysis.center.sentiment,
        tweets: convertTweets(analysis.center.tweetIndices)
      },
      right: {
        summary: analysis.right.summary,
        sentiment: analysis.right.sentiment,
        tweets: convertTweets(analysis.right.tweetIndices)
      }
    };
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    // Return neutral fallback
    return {
      nonBiasedSummary: article.description || article.title,
      left: { summary: 'Analysis unavailable', sentiment: 0, tweets: [] },
      center: { summary: 'Analysis unavailable', sentiment: 0, tweets: [] },
      right: { summary: 'Analysis unavailable', sentiment: 0, tweets: [] }
    };
  }
}

/**
 * Convert Newsdata article to OmniDoxa Story with Viewpoints
 */
export async function convertToStoryWithViewpoints(
  article: NewsdataArticle,
  storyId: number,
  intendedCategory?: string
): Promise<StoryWithViewpoints> {
  console.log(`🔍 Analyzing article: ${article.title.substring(0, 50)}...`);
  
  // Search X.com for tweets
  const searchResults = await searchXForArticle(article);
  
  // Analyze political sentiment
  const analysis = await searchResults.tweets.length > 0
    ? await analyzePoliticalSentiment(article, searchResults.tweets)
    : {
        nonBiasedSummary: article.description || article.title,
        left: { summary: 'No social media discussion found', sentiment: 0, tweets: [] },
        center: { summary: 'No social media discussion found', sentiment: 0, tweets: [] },
        right: { summary: 'No social media discussion found', sentiment: 0, tweets: [] }
      };

  // Create viewpoints
  const createViewpoint = (lean: Lean, data: typeof analysis.left): ViewpointWithPosts => ({
    id: storyId * 3 + (lean === 'left' ? 0 : lean === 'center' ? 1 : 2),
    story_id: storyId,
    lean,
    summary: data.summary,
    sentiment_score: data.sentiment,
    social_posts: data.tweets,
    created_at: new Date().toISOString()
  });

  const story: StoryWithViewpoints = {
    id: storyId,
    title: article.title,
    description: analysis.nonBiasedSummary,
    url: article.link,
    source: article.source_name,
    image_url: article.image_url,
    category: mapCategory(intendedCategory || article.category[0]),
    published_at: article.pubDate,
    fetched_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    viewpoints: [
      createViewpoint('left', analysis.left),
      createViewpoint('center', analysis.center),
      createViewpoint('right', analysis.right)
    ]
  };

  console.log(`✅ Analysis complete for: ${article.title.substring(0, 50)}...`);
  
  return story;
}

/**
 * Map Newsdata category to OmniDoxa category
 */
function mapCategory(newsdataCategory: string): any {
  // Keep Newsdata.io categories as-is
  const validCategories = ['breaking', 'business', 'crime', 'entertainment', 'politics', 'science', 'top', 'world'];
  return validCategories.includes(newsdataCategory) ? newsdataCategory : 'top';
}
