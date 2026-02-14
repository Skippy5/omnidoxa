/**
 * Grok-4 Sentiment Analysis using xAI SDK with x_search
 * Fetches REAL tweets from X/Twitter via Python xAI SDK
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import type { StoryWithViewpoints, ViewpointWithPosts, SocialPost } from './types';
import type { NewsdataArticle } from './newsdata';

const execAsync = promisify(exec);

interface TweetExample {
  author: string;
  handle: string;
  text: string;
  url: string;
}

interface Grok4Analysis {
  nonBiasedSummary: string;
  left: {
    sentiment: number;
    summary: string;
    tweets: TweetExample[];
  };
  center: {
    sentiment: number;
    summary: string;
    tweets: TweetExample[];
  };
  right: {
    sentiment: number;
    summary: string;
    tweets: TweetExample[];
  };
}

/**
 * Analyze article with Grok-4 using xAI SDK with x_search tool
 * Calls Python script that fetches REAL tweets from X/Twitter
 */
export async function analyzeWithGrok4(
  article: NewsdataArticle
): Promise<Grok4Analysis> {
  const scriptPath = path.join(process.cwd(), 'scripts', 'analyze-sentiment-xai.py');
  
  try {
    console.log(`  🔍 Calling xAI SDK for sentiment analysis...`);
    
    // Call Python script with article title and URL
    const { stdout, stderr } = await execAsync(
      `python3 "${scriptPath}" "${article.title.replace(/"/g, '\\"')}" "${article.link}"`,
      {
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        timeout: 120000, // 2 minute timeout
        env: {
          ...process.env,
          XAI_API_KEY: process.env.XAI_API_KEY || ''
        }
      }
    );
    
    if (stderr && stderr.trim()) {
      console.error('  ⚠️  Python stderr:', stderr);
    }
    
    const result = JSON.parse(stdout);
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    // Convert Python result format to expected TypeScript format
    const analysis: Grok4Analysis = {
      nonBiasedSummary: result.nonBiasedSummary || article.description || article.title,
      left: {
        sentiment: result.left?.sentiment || 0,
        summary: result.left?.summary || 'Analysis unavailable',
        tweets: (result.left?.tweets || []).map((t: any) => ({
          author: t.account || 'Unknown',
          handle: t.account || '@unknown',
          text: t.text || '',
          url: t.url || ''
        }))
      },
      center: {
        sentiment: result.center?.sentiment || 0,
        summary: result.center?.summary || 'Analysis unavailable',
        tweets: (result.center?.tweets || []).map((t: any) => ({
          author: t.account || 'Unknown',
          handle: t.account || '@unknown',
          text: t.text || '',
          url: t.url || ''
        }))
      },
      right: {
        sentiment: result.right?.sentiment || 0,
        summary: result.right?.summary || 'Analysis unavailable',
        tweets: (result.right?.tweets || []).map((t: any) => ({
          author: t.account || 'Unknown',
          handle: t.account || '@unknown',
          text: t.text || '',
          url: t.url || ''
        }))
      }
    };
    
    console.log(`  ✅ Analysis complete: ${analysis.left.tweets.length + analysis.center.tweets.length + analysis.right.tweets.length} tweets fetched`);
    
    return analysis;
  } catch (error) {
    console.error('  ❌ xAI analysis error:', error);
    
    // Return fallback structure
    return {
      nonBiasedSummary: article.description || article.title,
      left: { sentiment: 0, summary: 'Analysis unavailable', tweets: [] },
      center: { sentiment: 0, summary: 'Analysis unavailable', tweets: [] },
      right: { sentiment: 0, summary: 'Analysis unavailable', tweets: [] }
    };
  }
}

/**
 * Ensure category is a valid Category type
 */
function ensureValidCategory(cat: string): 'breaking' | 'business' | 'crime' | 'entertainment' | 'politics' | 'science' | 'top' | 'world' {
  const validCategories = ['breaking', 'business', 'crime', 'entertainment', 'politics', 'science', 'top', 'world'] as const;
  return validCategories.includes(cat as any) ? cat as any : 'top';
}

/**
 * Convert Grok-4 analysis to OmniDoxa Story format
 */
export async function convertToStoryWithGrok4(
  article: NewsdataArticle,
  storyId: number,
  intendedCategory?: string
): Promise<StoryWithViewpoints> {
  console.log(`🔍 Analyzing with Grok-4: ${article.title.substring(0, 50)}...`);
  
  const analysis = await analyzeWithGrok4(article);
  
  const convertTweets = (tweets: TweetExample[]): SocialPost[] => {
    return tweets.map((tweet, idx) => ({
      id: storyId * 100 + idx,
      viewpoint_id: 0, // Will be set when creating viewpoints
      author: tweet.author,
      content: tweet.text,
      url: tweet.url,
      platform: 'twitter',
      created_at: new Date().toISOString()
    }));
  };

  const createViewpoint = (lean: 'left' | 'center' | 'right', data: typeof analysis.left): ViewpointWithPosts => {
    const viewpointId = storyId * 3 + (lean === 'left' ? 0 : lean === 'center' ? 1 : 2);
    const socialPosts = convertTweets(data.tweets);
    
    // Set viewpoint_id for all posts
    socialPosts.forEach(post => {
      post.viewpoint_id = viewpointId;
    });
    
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

  // Use intended category if provided, otherwise use first article category
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
