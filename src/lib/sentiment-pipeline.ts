/**
 * Sentiment Pipeline - Orchestration Layer
 * 
 * Flow: Article → Search Tweets → Classify → Store in DB
 * 
 * Pipeline Steps:
 * 1. Search for tweets using twitterapi-io
 * 2. Classify tweets using AI (tweet-classifier)
 * 3. Distribute into LEFT/CENTER/RIGHT
 * 4. Generate viewpoint summaries
 * 5. Calculate sentiment scores
 * 6. Return complete data structure
 */

import {
  searchTweets,
  buildSearchQueries,
  fetchWithRetry,
  type TwitterApiTweet
} from './twitterapi-io';

import {
  classifyTweets,
  distributeTweets,
  generateViewpointSummary,
  calculateSentimentScore,
  type TweetClassification,
  type DistributedTweets
} from './tweet-classifier';

import type { ViewpointWithPosts } from './types';

// ============================================================================
// Type Definitions
// ============================================================================

export interface SentimentPipelineResult {
  success: boolean;
  viewpoints: ViewpointWithPosts[];
  tweetCount: number;
  source: 'twitter' | 'fallback';
  error?: string;
}

export interface Article {
  title: string;
  description?: string;
  category: string;
}

// ============================================================================
// Main Pipeline Function
// ============================================================================

/**
 * Run the complete sentiment analysis pipeline for an article
 * 
 * @param article - Article to analyze
 * @returns Sentiment pipeline result with viewpoints and tweets
 * 
 * @example
 * const result = await runSentimentPipeline({
 *   title: "Biden Unveils Economic Plan",
 *   description: "New policy aims to...",
 *   category: "politics"
 * });
 * 
 * if (result.success) {
 *   console.log(`Found ${result.tweetCount} tweets across ${result.viewpoints.length} viewpoints`);
 * }
 */
export async function runSentimentPipeline(
  article: Article
): Promise<SentimentPipelineResult> {
  console.log(`\n🔄 Starting sentiment pipeline for: ${article.title.substring(0, 60)}...`);

  try {
    // Step 1: Fetch tweets
    console.log('  📡 Fetching tweets...');
    const tweets = await fetchArticleTweets(article);

    if (tweets.length === 0) {
      console.warn('  ⚠️  No tweets found - will use fallback');
      return {
        success: false,
        viewpoints: [],
        tweetCount: 0,
        source: 'fallback',
        error: 'No tweets found for article'
      };
    }

    console.log(`  ✅ Found ${tweets.length} tweets`);

    // Step 2: Classify tweets with AI
    console.log('  🤖 Classifying tweets with AI...');
    const classifications = await classifyTweets(article, tweets);
    console.log(`  ✅ Classified ${classifications.length} tweets`);

    // Log classification breakdown
    const leanCounts = {
      left: classifications.filter(c => c.lean === 'left').length,
      center: classifications.filter(c => c.lean === 'center').length,
      right: classifications.filter(c => c.lean === 'right').length
    };
    console.log(`  📊 Distribution: LEFT=${leanCounts.left}, CENTER=${leanCounts.center}, RIGHT=${leanCounts.right}`);

    // Step 3: Distribute tweets into LEFT/CENTER/RIGHT
    console.log('  🎯 Distributing tweets...');
    const distributed = distributeTweets(classifications, tweets);
    console.log(`  ✅ Distributed: ${distributed.left.length} left, ${distributed.center.length} center, ${distributed.right.length} right`);

    // Step 4: Generate viewpoint summaries and build viewpoints
    console.log('  📝 Generating viewpoint summaries...');
    const viewpoints = buildViewpoints(distributed, classifications);
    console.log(`  ✅ Created ${viewpoints.length} viewpoints`);

    const totalTweets = viewpoints.reduce((sum, vp) => sum + vp.social_posts.length, 0);

    return {
      success: true,
      viewpoints,
      tweetCount: totalTweets,
      source: 'twitter'
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('  ❌ Pipeline failed:', errorMsg);

    return {
      success: false,
      viewpoints: [],
      tweetCount: 0,
      source: 'fallback',
      error: errorMsg
    };
  }
}

// ============================================================================
// Tweet Fetching
// ============================================================================

/**
 * Fetch tweets for an article using multi-strategy search
 * 
 * Strategies (tried in order until 15-20 tweets found):
 * 1. Full article title
 * 2. First 5 words
 * 3. Keywords only
 * 4. Keywords without retweets
 * 
 * @param article - Article to search tweets for
 * @returns Array of deduplicated tweets
 */
async function fetchArticleTweets(article: Article): Promise<TwitterApiTweet[]> {
  const queries = buildSearchQueries(article.title);
  const allTweets: TwitterApiTweet[] = [];
  const targetCount = 20; // Try to get 20 tweets for good distribution

  console.log(`  🔍 Trying ${queries.length} search strategies...`);

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];

    // Stop if we have enough tweets
    if (allTweets.length >= targetCount) {
      console.log(`  ✅ Target reached: ${allTweets.length} tweets`);
      break;
    }

    try {
      console.log(`  🔎 Strategy ${i + 1}/${queries.length}: "${query.substring(0, 50)}..."`);

      // Fetch with retry logic
      const response = await fetchWithRetry(
        () => searchTweets(query, 20),
        3 // Max 3 retries
      );

      if (response.tweets.length > 0) {
        console.log(`  📥 Retrieved ${response.tweets.length} tweets`);
        allTweets.push(...response.tweets);
      } else {
        console.log(`  ⏭️  No results for this query`);
      }

      // Rate limit protection: 500ms delay between searches
      if (i < queries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error) {
      console.error(`  ❌ Query failed: ${error instanceof Error ? error.message : String(error)}`);
      // Continue to next strategy
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const uniqueTweets = allTweets.filter(tweet => {
    if (seen.has(tweet.url)) return false;
    seen.add(tweet.url);
    return true;
  });
  console.log(`  🔄 Deduplicated: ${allTweets.length} → ${uniqueTweets.length} unique tweets`);

  return uniqueTweets;
}

// ============================================================================
// Viewpoint Building
// ============================================================================

/**
 * Build viewpoint objects with social posts from distributed tweets
 * 
 * @param distributed - Tweets distributed by lean
 * @param classifications - Original classifications (for confidence/reasoning)
 * @returns Array of viewpoints with social posts
 */
function buildViewpoints(
  distributed: DistributedTweets,
  classifications: TweetClassification[]
): ViewpointWithPosts[] {
  const viewpoints: ViewpointWithPosts[] = [];

  // Create viewpoint for each lean
  for (const lean of ['left', 'center', 'right'] as const) {
    const tweets = distributed[lean];

    // Generate summary
    const summary = generateViewpointSummary(lean, tweets);

    // Calculate sentiment score
    const sentimentScore = calculateSentimentScore(tweets);

    // Convert tweets to social posts
    const socialPosts = tweets.map((tweet, index) => {
      return {
        id: 0, // Will be set by database
        viewpoint_id: 0, // Will be set by database
        author: tweet.author.name,
        author_handle: `@${tweet.author.userName}`,
        text: tweet.text,
        url: tweet.url,
        platform: 'twitter' as const,
        likes: tweet.likeCount,
        retweets: tweet.retweetCount,
        is_real: true,   // real tweets from Twitter API
        post_date: null, // Twitter API doesn't return post dates in this pipeline
        created_at: new Date().toISOString()
      };
    });

    viewpoints.push({
      id: 0, // Will be set by database
      story_id: 0, // Will be set by caller
      lean,
      summary,
      sentiment_score: sentimentScore,
      created_at: new Date().toISOString(),
      social_posts: socialPosts
    });
  }

  return viewpoints;
}

// ============================================================================
// Fallback: Keyword-Based Sentiment (if Twitter fails)
// ============================================================================

/**
 * Generate fallback viewpoints using keyword-based sentiment
 * Used when Twitter API fails or returns no results
 * 
 * @param article - Article to analyze
 * @returns Viewpoints with generic summaries (no tweets)
 */
export function generateKeywordFallback(article: Article): ViewpointWithPosts[] {
  console.log('  🔄 Generating keyword-based fallback...');

  const viewpoints: ViewpointWithPosts[] = [
    {
      id: 0,
      story_id: 0,
      lean: 'left',
      summary: `Progressive perspective on ${article.title}`,
      sentiment_score: 0,
      created_at: new Date().toISOString(),
      social_posts: []
    },
    {
      id: 0,
      story_id: 0,
      lean: 'center',
      summary: `Balanced analysis of ${article.title}`,
      sentiment_score: 0,
      created_at: new Date().toISOString(),
      social_posts: []
    },
    {
      id: 0,
      story_id: 0,
      lean: 'right',
      summary: `Conservative viewpoint on ${article.title}`,
      sentiment_score: 0,
      created_at: new Date().toISOString(),
      social_posts: []
    }
  ];

  console.log('  ✅ Generated 3 fallback viewpoints');
  return viewpoints;
}

// ============================================================================
// Pipeline Stats & Monitoring
// ============================================================================

/**
 * Log pipeline performance statistics
 */
export function logPipelineStats(results: SentimentPipelineResult[]): void {
  const total = results.length;
  const successful = results.filter(r => r.success).length;
  const fallbacks = results.filter(r => r.source === 'fallback').length;
  const avgTweets = results.reduce((sum, r) => sum + r.tweetCount, 0) / total;

  console.log('\n📊 Sentiment Pipeline Statistics:');
  console.log(`  Total articles: ${total}`);
  console.log(`  Successful: ${successful} (${(successful/total*100).toFixed(1)}%)`);
  console.log(`  Fallbacks: ${fallbacks} (${(fallbacks/total*100).toFixed(1)}%)`);
  console.log(`  Avg tweets/article: ${avgTweets.toFixed(1)}`);
}

// ============================================================================
// Exports
// ============================================================================

export default {
  runSentimentPipeline,
  generateKeywordFallback,
  logPipelineStats
};
