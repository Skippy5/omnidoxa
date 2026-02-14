/**
 * xAI Python Bridge - TypeScript interface to Python xAI SDK
 * Calls Python script that uses xAI SDK with x_search() for REAL tweets
 */

import { spawn } from 'child_process';
import path from 'path';
import type { StoryWithViewpoints, ViewpointWithPosts, SocialPost } from './types';
import type { NewsdataArticle } from './newsdata';

interface TweetData {
  author: string;
  handle: string;
  text: string;
  url: string;
}

interface PythonAnalysisResult {
  nonBiasedSummary: string;
  left: {
    sentiment: number;
    summary: string;
    tweets: TweetData[];
  };
  center: {
    sentiment: number;
    summary: string;
    tweets: TweetData[];
  };
  right: {
    sentiment: number;
    summary: string;
    tweets: TweetData[];
  };
  error?: string;
}

/**
 * Call Python xAI SDK script to analyze article sentiment
 * Returns structured analysis with REAL tweets from X/Twitter
 */
export async function analyzeWithPythonXAI(
  article: NewsdataArticle
): Promise<PythonAnalysisResult> {
  
  const pythonScript = path.join(process.cwd(), 'python', 'xai_sentiment_v2.py');
  
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [pythonScript, article.title, article.link]);
    
    let stdout = '';
    let stderr = '';
    
    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    python.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python script error (code ${code}):`, stderr);
        resolve({
          nonBiasedSummary: article.description || article.title,
          left: { sentiment: 0, summary: 'Analysis unavailable', tweets: [] },
          center: { sentiment: 0, summary: 'Analysis unavailable', tweets: [] },
          right: { sentiment: 0, summary: 'Analysis unavailable', tweets: [] },
          error: stderr
        });
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        
        // Log tweet counts
        const totalTweets = result.left.tweets.length + result.center.tweets.length + result.right.tweets.length;
        console.log(`  📊 Got ${totalTweets} REAL tweets (L:${result.left.tweets.length} C:${result.center.tweets.length} R:${result.right.tweets.length})`);
        
        resolve(result);
      } catch (error) {
        console.error('Failed to parse Python output:', error);
        console.error('Raw output:', stdout);
        reject(error);
      }
    });
    
    python.on('error', (error) => {
      console.error('Failed to spawn Python process:', error);
      reject(error);
    });
  });
}

/**
 * Convert Newsdata article to OmniDoxa Story using Python xAI SDK
 */
export async function convertToStoryWithPythonXAI(
  article: NewsdataArticle,
  storyId: number,
  intendedCategory?: string
): Promise<StoryWithViewpoints> {
  
  console.log(`  🐍 Calling Python xAI SDK with x_search()...`);
  
  const analysis = await analyzeWithPythonXAI(article);
  
  if (analysis.error) {
    console.error(`  ⚠️  Python analysis had errors: ${analysis.error}`);
  }
  
  const convertTweets = (tweets: TweetData[], lean: 'left' | 'center' | 'right'): SocialPost[] => {
    const offset = lean === 'left' ? 0 : lean === 'center' ? 3 : 6;
    return tweets.map((tweet, idx) => ({
      id: (storyId * 9) + offset + idx,
      viewpoint_id: storyId * 3 + (lean === 'left' ? 0 : lean === 'center' ? 1 : 2),
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
