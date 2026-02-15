/**
 * TwitterAPI.io Integration
 * Replaces Twitter API v2 with twitterapi.io for tweet search
 * 
 * Features:
 * - Multi-query search strategy (4 attempts per article)
 * - Rate limiting (100 requests/minute)
 * - Error handling with exponential backoff retry
 * - Tweet deduplication
 */

export interface TwitterApiTweet {
  id: string;
  url: string;
  text: string;
  createdAt: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  author: {
    userName: string;
    name: string;
    id: string;
    profilePicture?: string;
    isBlueVerified?: boolean;
    followers: number;
  };
}

export interface TwitterApiResponse {
  tweets: TwitterApiTweet[];
  has_next_page: boolean;
  next_cursor?: string;
}

/**
 * Rate limiter to prevent hitting API limits
 */
class RateLimiter {
  private lastRequestTime: number = 0;
  private minDelay: number; // milliseconds between requests

  constructor(requestsPerMinute: number) {
    // Convert requests per minute to milliseconds between requests
    this.minDelay = (60 * 1000) / requestsPerMinute;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minDelay) {
      const waitTime = this.minDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }
}

// Global rate limiter: 30 requests per minute (very conservative to avoid 429 errors)
// API claims 1000+ QPS but actual limits seem stricter
const rateLimiter = new RateLimiter(30);

/**
 * Search tweets using twitterapi.io API
 */
export async function searchTweets(
  query: string,
  count: number = 20
): Promise<TwitterApiResponse> {
  const apiKey = process.env.TWITTERAPI_IO_KEY;
  
  if (!apiKey) {
    throw new Error('TWITTERAPI_IO_KEY not configured in environment');
  }

  // Apply rate limiting
  await rateLimiter.throttle();

  const url = new URL('https://api.twitterapi.io/twitter/tweet/advanced_search');
  url.searchParams.set('query', query);
  url.searchParams.set('queryType', 'Latest');
  url.searchParams.set('count', count.toString());

  const response = await fetch(url.toString(), {
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    
    // Handle specific error cases
    if (response.status === 401) {
      throw new Error('TWITTERAPI_IO_KEY is invalid or expired');
    } else if (response.status === 429) {
      throw new Error('Rate limit exceeded - too many requests');
    } else if (response.status === 400) {
      throw new Error(`Malformed query: ${errorText}`);
    } else {
      throw new Error(`TwitterAPI.io error (${response.status}): ${errorText}`);
    }
  }

  const data = await response.json();
  
  // Normalize response format
  return {
    tweets: data.tweets || [],
    has_next_page: data.has_next_page || false,
    next_cursor: data.next_cursor
  };
}

/**
 * Retry a function with exponential backoff
 * Used for handling transient network errors
 */
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      // Don't retry on authentication errors
      if (error instanceof Error && error.message.includes('invalid or expired')) {
        throw error;
      }
      
      // Last attempt - throw the error
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, i) * 1000;
      console.warn(`[twitterapi-io] Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Max retries exceeded');
}

/**
 * Build multiple search query strategies for an article
 * Tries progressively broader searches until tweets are found
 */
export function buildSearchQueries(title: string): string[] {
  const queries: string[] = [];
  
  // Strategy 1: Full title in quotes (exact match)
  queries.push(`"${title}"`);
  
  // Strategy 2: First 5 words (still quoted for phrase match)
  const firstFive = title.split(/\s+/).slice(0, 5).join(' ');
  if (firstFive !== title) {
    queries.push(`"${firstFive}"`);
  }
  
  // Strategy 3: Keywords only (remove stopwords, no quotes)
  const keywords = extractKeywords(title);
  if (keywords && keywords !== title) {
    queries.push(keywords);
  }
  
  // Strategy 4: Fallback - keywords with -is:retweet filter
  if (keywords) {
    queries.push(`${keywords} -is:retweet`);
  }
  
  return queries;
}

/**
 * Extract important keywords from title
 * Removes common stopwords and keeps meaningful terms
 */
export function extractKeywords(title: string): string {
  const stopwords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'should', 'could', 'may', 'might', 'must', 'can', 'says', 'said'
  ]);
  
  const words = title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => 
      word.length > 3 && // Keep words longer than 3 chars
      !stopwords.has(word) // Remove stopwords
    );
  
  // Return top 4 keywords
  return words.slice(0, 4).join(' ');
}

/**
 * Search for tweets about an article using multiple query strategies
 * Stops when enough tweets are found or all strategies exhausted
 */
export async function searchArticleTweets(
  articleTitle: string,
  targetCount: number = 20
): Promise<TwitterApiTweet[]> {
  const queries = buildSearchQueries(articleTitle);
  const allTweets: TwitterApiTweet[] = [];
  const seenUrls = new Set<string>();

  console.log(`[twitterapi-io] Searching for tweets about: "${articleTitle}"`);
  console.log(`[twitterapi-io] Query strategies: ${queries.length}`);

  for (let index = 0; index < queries.length; index++) {
    const query = queries[index];
    
    // Stop if we have enough tweets
    if (allTweets.length >= targetCount) {
      console.log(`[twitterapi-io] Target reached: ${allTweets.length} tweets`);
      break;
    }
    
    try {
      console.log(`[twitterapi-io] Strategy ${index + 1}/${queries.length}: "${query}"`);
      
      // Fetch with retry logic
      const response = await fetchWithRetry(() => searchTweets(query, targetCount));
      
      // Deduplicate by URL
      let newTweets = 0;
      for (const tweet of response.tweets) {
        if (seenUrls.has(tweet.url)) continue;
        
        seenUrls.add(tweet.url);
        allTweets.push(tweet);
        newTweets++;
        
        if (allTweets.length >= targetCount) break;
      }
      
      console.log(`[twitterapi-io] Found ${newTweets} new tweets (total: ${allTweets.length})`);
      
      // Delay between different query strategies (2 seconds to avoid rate limits)
      if (index < queries.length - 1 && allTweets.length < targetCount) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error(`[twitterapi-io] Query "${query}" failed:`, error);
      // Continue to next query strategy instead of failing completely
    }
  }

  console.log(`[twitterapi-io] Search complete: ${allTweets.length} unique tweets found`);
  return allTweets;
}

/**
 * Deduplicate tweets by URL
 * Removes duplicate tweets based on their URL
 * 
 * @param tweets - Array of tweets (may contain duplicates)
 * @returns Deduplicated array of tweets
 */
export function deduplicateTweets(tweets: TwitterApiTweet[]): TwitterApiTweet[] {
  const seenUrls = new Set<string>();
  const uniqueTweets: TwitterApiTweet[] = [];
  
  for (const tweet of tweets) {
    if (!seenUrls.has(tweet.url)) {
      seenUrls.add(tweet.url);
      uniqueTweets.push(tweet);
    }
  }
  
  return uniqueTweets;
}

/**
 * Exports
 */
export {
  rateLimiter,
  fetchWithRetry
};
