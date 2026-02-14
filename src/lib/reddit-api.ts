/**
 * Reddit API Integration for OmniDoxa
 * Uses Reddit API to get REAL political discussions
 */

import type { NewsdataArticle } from './newsdata';

interface RedditPost {
  id: string;
  author: string;
  title: string;
  selftext: string;
  url: string;
  permalink: string;
  score: number;
  subreddit: string;
  created_utc: number;
}

interface RedditComment {
  id: string;
  author: string;
  body: string;
  permalink: string;
  score: number;
  subreddit: string;
  created_utc: number;
}

interface RedditData {
  username: string;
  content: string;
  url: string;
  score: number;
  subreddit: string;
  lean: 'left' | 'center' | 'right';
}

// Subreddit categorization
const SUBREDDIT_LEANS: Record<string, 'left' | 'center' | 'right'> = {
  'politics': 'left',
  'democrats': 'left',
  'liberal': 'left',
  'progressive': 'left',
  'Conservative': 'right',
  'Republican': 'right',
  'conservatives': 'right',
  'NeutralPolitics': 'center',
  'moderatepolitics': 'center',
  'PoliticalDiscussion': 'center'
};

/**
 * Get Reddit OAuth token
 */
async function getRedditToken(): Promise<string> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error('Reddit credentials not configured in .env.local');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'OmniDoxa/1.0'
    },
    body: `grant_type=password&username=${username}&password=${password}`
  });

  const data = await response.json();
  
  if (!response.ok || !data.access_token) {
    throw new Error(`Reddit auth failed: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

/**
 * Search Reddit for posts/comments about an article
 */
async function searchReddit(query: string, subreddit: string, limit: number = 10): Promise<RedditData[]> {
  const token = await getRedditToken();
  
  const searchUrl = `https://oauth.reddit.com/r/${subreddit}/search?q=${encodeURIComponent(query)}&sort=relevance&limit=${limit}&restrict_sr=true&t=week`;
  
  try {
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'OmniDoxa/1.0'
      }
    });

    if (!response.ok) {
      console.error(`Reddit search failed for r/${subreddit}:`, await response.text());
      return [];
    }

    const data = await response.json();
    const posts = data.data?.children || [];
    
    const results: RedditData[] = [];
    const lean = SUBREDDIT_LEANS[subreddit] || 'center';
    
    for (const child of posts.slice(0, 5)) {
      const post = child.data;
      
      // Skip deleted/removed posts
      if (post.author === '[deleted]' || !post.selftext) continue;
      
      results.push({
        username: `u/${post.author}`,
        content: post.selftext.substring(0, 300), // First 300 chars
        url: `https://reddit.com${post.permalink}`,
        score: post.score || 0,
        subreddit: post.subreddit,
        lean
      });
    }
    
    return results;
  } catch (error) {
    console.error(`Error searching r/${subreddit}:`, error);
    return [];
  }
}

/**
 * Get top comments from a post
 */
async function getTopComments(postId: string, subreddit: string, limit: number = 5): Promise<RedditData[]> {
  const token = await getRedditToken();
  const lean = SUBREDDIT_LEANS[subreddit] || 'center';
  
  try {
    const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/comments/${postId}?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'OmniDoxa/1.0'
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    const comments = data[1]?.data?.children || [];
    
    const results: RedditData[] = [];
    
    for (const child of comments) {
      const comment = child.data;
      
      if (comment.author === '[deleted]' || !comment.body || comment.stickied) continue;
      
      results.push({
        username: `u/${comment.author}`,
        content: comment.body.substring(0, 300),
        url: `https://reddit.com${comment.permalink}`,
        score: comment.score || 0,
        subreddit,
        lean
      });
    }
    
    return results.slice(0, 3);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return [];
  }
}

/**
 * Search for Reddit discussions about an article
 */
export async function searchArticleOnReddit(article: NewsdataArticle): Promise<{
  left: RedditData[];
  center: RedditData[];
  right: RedditData[];
}> {
  // Build search query from article title
  const query = article.title.split(' ').slice(0, 5).join(' '); // First 5 words
  
  console.log(`  🔍 Searching Reddit for: ${query.substring(0, 50)}...`);
  
  // Search multiple subreddits in parallel
  const [leftResults, centerResults, rightResults] = await Promise.all([
    searchReddit(query, 'politics', 10),
    searchReddit(query, 'NeutralPolitics', 10),
    searchReddit(query, 'Conservative', 10)
  ]);
  
  console.log(`  📊 Found: L:${leftResults.length} C:${centerResults.length} R:${rightResults.length}`);
  
  return {
    left: leftResults.slice(0, 3),
    center: centerResults.slice(0, 3),
    right: rightResults.slice(0, 3)
  };
}

/**
 * Summarize Reddit content using Grok
 */
export async function summarizeRedditPost(content: string): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  
  if (!apiKey) return content.substring(0, 200) + '...';
  
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
            content: 'Summarize Reddit posts into 1-2 sentences. Be concise and neutral.'
          },
          {
            role: 'user',
            content: `Summarize this Reddit post in 1-2 sentences:\n\n${content}`
          }
        ],
        temperature: 0.3,
        max_tokens: 100
      })
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || content.substring(0, 200) + '...';
  } catch (error) {
    console.error('Failed to summarize:', error);
    return content.substring(0, 200) + '...';
  }
}
