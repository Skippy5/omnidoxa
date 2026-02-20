/**
 * Quick Sentiment Analysis using xAI SDK with x_search
 * Analyzes article content and fetches REAL tweets from X/Twitter
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import type { StoryWithViewpoints, ViewpointWithPosts } from './types';
import type { NewsdataArticle } from './newsdata';

const execAsync = promisify(exec);

interface QuickAnalysis {
  nonBiasedSummary: string;
  left: {
    summary: string;
    sentiment: number;
    tweets: Array<{account: string; text: string; url: string}>;
  };
  center: {
    summary: string;
    sentiment: number;
    tweets: Array<{account: string; text: string; url: string}>;
  };
  right: {
    summary: string;
    sentiment: number;
    tweets: Array<{account: string; text: string; url: string}>;
  };
}

/**
 * Political sentiment analysis using xAI SDK with real tweet fetching
 */
async function analyzeArticleWithXAI(article: NewsdataArticle): Promise<QuickAnalysis> {
  const scriptPath = path.join(process.cwd(), 'scripts', 'analyze-sentiment-xai.py');
  
  try {
    // Call Python script with article title and URL
    const { stdout, stderr } = await execAsync(
      `python3 "${scriptPath}" "${article.title.replace(/"/g, '\\"')}" "${article.link}"`,
      {
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer for large responses
        timeout: 120000 // 2 minute timeout
      }
    );
    
    if (stderr) {
      console.error('Python script stderr:', stderr);
    }
    
    const result = JSON.parse(stdout);
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    return result;
  } catch (error) {
    console.error('Error calling xAI sentiment analysis:', error);
    
    // Return fallback structure
    return {
      nonBiasedSummary: article.description || article.title,
      left: { summary: 'Analysis unavailable', sentiment: 0, tweets: [] },
      center: { summary: 'Analysis unavailable', sentiment: 0, tweets: [] },
      right: { summary: 'Analysis unavailable', sentiment: 0, tweets: [] }
    };
  }
}

/**
 * Convert Newsdata article to OmniDoxa Story with xAI sentiment analysis
 */
export async function convertToStoryWithXAI(
  article: NewsdataArticle,
  storyId: number
): Promise<StoryWithViewpoints> {
  const analysis = await analyzeArticleWithXAI(article);

  const createViewpoint = (lean: 'left' | 'center' | 'right', data: typeof analysis.left): ViewpointWithPosts => ({
    id: storyId * 3 + (lean === 'left' ? 0 : lean === 'center' ? 1 : 2),
    story_id: storyId,
    lean,
    summary: data.summary,
    sentiment_score: data.sentiment,
    social_posts: data.tweets.map((tweet, idx) => ({
      id: (storyId * 9) + (lean === 'left' ? 0 : lean === 'center' ? 3 : 6) + idx,
      viewpoint_id: storyId * 3 + (lean === 'left' ? 0 : lean === 'center' ? 1 : 2),
      author: tweet.account,
      author_handle: tweet.account.toLowerCase().replace(/\s+/g, ''),
      text: tweet.text,
      url: tweet.url,
      platform: 'twitter',
      likes: 0,
      retweets: 0,
      is_real: false,  // synthetic/example posts
      post_date: null,
      created_at: new Date().toISOString()
    })),
    created_at: new Date().toISOString()
  });

  const mapCategory = (cat: string): any => {
    const validCategories = ['breaking', 'business', 'crime', 'entertainment', 'politics', 'science', 'top', 'world'];
    return validCategories.includes(cat) ? cat : 'top';
  };

  return {
    id: storyId,
    title: article.title,
    description: analysis.nonBiasedSummary,
    url: article.link,
    source: article.source_name,
    image_url: article.image_url,
    category: mapCategory(article.category[0]),
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
