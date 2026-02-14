/**
 * Twitter API v2 Integration
 * Uses official Twitter API for real tweet search
 */

import type { NewsdataArticle } from './newsdata';

interface TwitterTweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
}

interface TwitterUser {
  id: string;
  name: string;
  username: string;
}

interface TwitterSearchResult {
  tweets: TwitterTweet[];
  users: TwitterUser[];
}

export interface TweetData {
  author: string;
  handle: string;
  text: string;
  url: string;
  likes: number;
  retweets: number;
}

/**
 * Search Twitter for recent tweets about an article
 */
export async function searchTwitter(query: string, maxResults: number = 10): Promise<TwitterSearchResult> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  
  if (!bearerToken) {
    throw new Error('TWITTER_BEARER_TOKEN not configured');
  }

  // Build search query
  const searchQuery = encodeURIComponent(`${query} -is:retweet lang:en`);
  
  // Twitter API v2 endpoint
  const url = `https://api.twitter.com/2/tweets/search/recent?query=${searchQuery}&max_results=${maxResults}&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=name,username`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Twitter API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    
    return {
      tweets: data.data || [],
      users: data.includes?.users || []
    };
  } catch (error) {
    console.error('Twitter search error:', error);
    return { tweets: [], users: [] };
  }
}

/**
 * Search for tweets about an article with multiple query attempts
 */
export async function searchArticleTweets(article: NewsdataArticle): Promise<TweetData[]> {
  // Try multiple search strategies
  const queries = [
    article.title, // Full title
    article.title.split(' ').slice(0, 5).join(' '), // First 5 words
    extractKeywords(article.title) // Key terms only
  ];

  let allTweets: TweetData[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    if (allTweets.length >= 9) break; // Got enough tweets
    
    try {
      const result = await searchTwitter(query, 15);
      
      // Convert to TweetData format
      for (const tweet of result.tweets) {
        if (allTweets.length >= 15) break; // Max 15 tweets
        
        const user = result.users.find(u => u.id === tweet.author_id);
        if (!user) continue;
        
        const tweetUrl = `https://x.com/${user.username}/status/${tweet.id}`;
        if (seenUrls.has(tweetUrl)) continue; // Skip duplicates
        
        seenUrls.add(tweetUrl);
        allTweets.push({
          author: user.name,
          handle: `@${user.username}`,
          text: tweet.text,
          url: tweetUrl,
          likes: tweet.public_metrics?.like_count || 0,
          retweets: tweet.public_metrics?.retweet_count || 0
        });
      }
      
      // Small delay between searches to avoid rate limits
      if (allTweets.length < 9) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`Search failed for query: ${query}`, error);
    }
  }

  return allTweets;
}

/**
 * Extract keywords from article title for better search
 */
function extractKeywords(title: string): string {
  // Remove common words and keep important terms
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'says', 'said']);
  
  const words = title.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  // Return top 3-4 keywords
  return words.slice(0, 4).join(' ');
}

/**
 * Analyze political lean of a tweet (simple heuristic)
 * Returns: 'left', 'center', or 'right'
 */
export function analyzeTweetLean(tweet: TweetData): 'left' | 'center' | 'right' {
  const text = tweet.text.toLowerCase();
  
  // Simple keyword-based heuristics
  const leftKeywords = ['progressive', 'liberal', 'democrat', 'biden', 'bernie', 'aoc', 'climate', 'inequality', 'workers', 'unions'];
  const rightKeywords = ['conservative', 'republican', 'trump', 'maga', 'freedom', 'america first', 'patriot', 'liberty'];
  
  let leftScore = 0;
  let rightScore = 0;
  
  for (const keyword of leftKeywords) {
    if (text.includes(keyword)) leftScore++;
  }
  
  for (const keyword of rightKeywords) {
    if (text.includes(keyword)) rightScore++;
  }
  
  // Check account handle for political indicators
  const handle = tweet.handle.toLowerCase();
  if (handle.includes('dem') || handle.includes('lib') || handle.includes('prog')) leftScore += 2;
  if (handle.includes('rep') || handle.includes('gop') || handle.includes('maga') || handle.includes('conservative')) rightScore += 2;
  
  if (leftScore > rightScore + 1) return 'left';
  if (rightScore > leftScore + 1) return 'right';
  return 'center';
}

/**
 * Distribute tweets across left/center/right perspectives
 */
export function distributeTweets(tweets: TweetData[]): {
  left: TweetData[];
  center: TweetData[];
  right: TweetData[];
} {
  const left: TweetData[] = [];
  const center: TweetData[] = [];
  const right: TweetData[] = [];
  
  // Analyze each tweet
  for (const tweet of tweets) {
    const lean = analyzeTweetLean(tweet);
    
    if (lean === 'left' && left.length < 3) {
      left.push(tweet);
    } else if (lean === 'right' && right.length < 3) {
      right.push(tweet);
    } else if (center.length < 3) {
      center.push(tweet);
    }
  }
  
  // Fill in missing slots with remaining tweets
  const remaining = tweets.filter(t => 
    !left.includes(t) && !center.includes(t) && !right.includes(t)
  );
  
  let idx = 0;
  while (left.length < 3 && idx < remaining.length) left.push(remaining[idx++]);
  while (center.length < 3 && idx < remaining.length) center.push(remaining[idx++]);
  while (right.length < 3 && idx < remaining.length) right.push(remaining[idx++]);
  
  return { left, center, right };
}
