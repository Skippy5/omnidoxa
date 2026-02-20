/**
 * Reddit + Grok Sentiment Analysis
 * Uses Reddit API for REAL discussions + Grok for sentiment scoring
 */

import type { StoryWithViewpoints, ViewpointWithPosts, SocialPost } from './types';
import type { NewsdataArticle } from './newsdata';
import { searchArticleOnReddit, summarizeRedditPost, type RedditData } from './reddit-api';

interface SentimentAnalysis {
  nonBiasedSummary: string;
  left: { summary: string; sentiment: number };
  center: { summary: string; sentiment: number };
  right: { summary: string; sentiment: number };
}

/**
 * Analyze sentiment using Grok (without Reddit posts)
 */
async function analyzeSentiment(article: NewsdataArticle): Promise<SentimentAnalysis> {
  const apiKey = process.env.XAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('XAI_API_KEY not configured');
  }

  const prompt = `Analyze political sentiment for this article:

**Title:** ${article.title}
**Description:** ${article.description || 'N/A'}

Provide:
1. Non-biased summary (2-3 sentences)
2. For each perspective (left, center, right):
   - Sentiment score from -1 (very negative) to +1 (very positive)
   - Summary of how that perspective views this (2-3 sentences)

Return ONLY valid JSON:
{
  "nonBiasedSummary": "...",
  "left": {"sentiment": 0.5, "summary": "..."},
  "center": {"sentiment": 0.0, "summary": "..."},
  "right": {"sentiment": -0.3, "summary": "..."}
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
          { role: 'system', content: 'You are a political analyst. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Grok API error: ${JSON.stringify(data)}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content in Grok response');

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
 * Convert article to Story with Reddit discussions
 */
export async function convertToStoryWithReddit(
  article: NewsdataArticle,
  storyId: number,
  intendedCategory?: string
): Promise<StoryWithViewpoints> {
  
  console.log(`  🔍 Searching Reddit for: ${article.title.substring(0, 50)}...`);
  
  // Get real Reddit discussions
  const redditData = await searchArticleOnReddit(article);
  
  console.log(`  📊 Found Reddit posts: L:${redditData.left.length} C:${redditData.center.length} R:${redditData.right.length}`);
  
  // Summarize Reddit posts
  console.log(`  📝 Summarizing posts...`);
  const summarized = {
    left: await Promise.all(redditData.left.map(async post => ({
      ...post,
      summary: await summarizeRedditPost(post.content)
    }))),
    center: await Promise.all(redditData.center.map(async post => ({
      ...post,
      summary: await summarizeRedditPost(post.content)
    }))),
    right: await Promise.all(redditData.right.map(async post => ({
      ...post,
      summary: await summarizeRedditPost(post.content)
    })))
  };
  
  // Analyze overall sentiment with Grok
  console.log(`  🤖 Analyzing sentiment with Grok...`);
  const sentiment = await analyzeSentiment(article);
  
  // Convert Reddit posts to SocialPost format
  const convertRedditPosts = (posts: Array<{ username: string; summary: string; url: string; score: number; subreddit: string }>, lean: 'left' | 'center' | 'right'): SocialPost[] => {
    const offset = lean === 'left' ? 0 : lean === 'center' ? 3 : 6;
    return posts.map((post, idx) => ({
      id: (storyId * 9) + offset + idx,
      viewpoint_id: storyId * 3 + (lean === 'left' ? 0 : lean === 'center' ? 1 : 2),
      author: post.username.replace('u/', ''),
      author_handle: post.username,
      text: post.summary,
      url: post.url,
      platform: 'reddit',
      likes: post.score,
      retweets: 0,
      is_real: false,  // synthetic/aggregated posts
      post_date: null,
      created_at: new Date().toISOString()
    }));
  };

  const createViewpoint = (lean: 'left' | 'center' | 'right', sentimentData: typeof sentiment.left, posts: any[]): ViewpointWithPosts => {
    return {
      id: storyId * 3 + (lean === 'left' ? 0 : lean === 'center' ? 1 : 2),
      story_id: storyId,
      lean,
      summary: sentimentData.summary,
      sentiment_score: sentimentData.sentiment,
      social_posts: convertRedditPosts(posts, lean),
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
      createViewpoint('left', sentiment.left, summarized.left),
      createViewpoint('center', sentiment.center, summarized.center),
      createViewpoint('right', sentiment.right, summarized.right)
    ]
  };
}
