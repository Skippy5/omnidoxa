/**
 * AI-Powered Tweet Classification (LEFT/CENTER/RIGHT)
 * Uses xAI Grok 3 Mini for political bias detection
 * 
 * Classification Logic:
 * - LEFT: Pro-Democrat, progressive policies, social justice, climate action
 * - RIGHT: Pro-Republican, conservative values, limited government, traditional values
 * - CENTER: Neutral/balanced, fact-focused, bipartisan, ambiguous lean
 */

import type { TwitterApiTweet } from './twitterapi-io';

// ============================================================================
// Type Definitions
// ============================================================================

export interface TweetClassification {
  tweetIndex: number;
  lean: 'left' | 'center' | 'right';
  confidence: number; // 0.0 - 1.0
  reasoning: string;
}

export interface ClassificationResult {
  classifications: TweetClassification[];
}

export interface DistributedTweets {
  left: TwitterApiTweet[];
  center: TwitterApiTweet[];
  right: TwitterApiTweet[];
}

// ============================================================================
// Core Classification Function
// ============================================================================

/**
 * Classify tweets by political lean using Grok AI
 * 
 * @param article - Article metadata (title, description)
 * @param tweets - Array of tweets to classify
 * @returns Array of classifications with confidence scores
 * 
 * @example
 * const classifications = await classifyTweets(
 *   { title: "Biden Economy Plan", description: "..." },
 *   tweets
 * );
 */
export async function classifyTweets(
  article: { title: string; description?: string },
  tweets: TwitterApiTweet[]
): Promise<TweetClassification[]> {
  // Validate API key
  const apiKey = process.env.XAI_API_KEY;
  console.log('[DEBUG] XAI_API_KEY last 10 chars:', apiKey?.slice(-10) || 'NOT SET');
  if (!apiKey) {
    throw new Error('XAI_API_KEY not configured in environment');
  }

  // Build classification prompt
  const prompt = buildClassificationPrompt(article, tweets);

  try {
    // Call Grok API
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a political bias classifier. Analyze tweets and classify them as LEFT, CENTER, or RIGHT based on political lean. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3 // Lower temperature for more consistent classifications
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Grok API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // Parse response
    const content = data.choices[0].message.content;
    const result: ClassificationResult = JSON.parse(content);

    // Validate response structure
    if (!result.classifications || !Array.isArray(result.classifications)) {
      throw new Error('Invalid classification response format');
    }

    // Validate and normalize each classification
    for (const classification of result.classifications) {
      // Normalize lean to lowercase (AI might return uppercase)
      const normalizedLean = classification.lean.toLowerCase() as 'left' | 'center' | 'right';
      
      if (!['left', 'center', 'right'].includes(normalizedLean)) {
        console.warn(`Invalid lean value: ${classification.lean}, defaulting to center`);
        classification.lean = 'center';
      } else {
        classification.lean = normalizedLean;
      }
      
      if (typeof classification.confidence !== 'number' || classification.confidence < 0 || classification.confidence > 1) {
        console.warn(`Invalid confidence value: ${classification.confidence}, defaulting to 0.5`);
        classification.confidence = 0.5;
      }
    }

    return result.classifications;

  } catch (error) {
    console.error('Tweet classification failed:', error);
    
    // Fallback: classify all tweets as center with low confidence
    return tweets.map((_, index) => ({
      tweetIndex: index,
      lean: 'center' as const,
      confidence: 0.3,
      reasoning: 'Classification failed - defaulted to center'
    }));
  }
}

// ============================================================================
// Prompt Building
// ============================================================================

/**
 * Build the classification prompt for Grok
 * 
 * @param article - Article metadata
 * @param tweets - Tweets to classify
 * @returns Formatted prompt string
 */
function buildClassificationPrompt(
  article: { title: string; description?: string },
  tweets: TwitterApiTweet[]
): string {
  const tweetList = tweets.map((tweet, index) => {
    return `${index + 1}. @${tweet.author.userName} (${tweet.author.followers} followers):
   "${tweet.text}"
   [Likes: ${tweet.likeCount}, Retweets: ${tweet.retweetCount}]`;
  }).join('\n\n');

  return `You are analyzing tweets about the following news article. Classify EACH tweet as LEFT, CENTER, or RIGHT based on political lean.

**Article Title:** ${article.title}
${article.description ? `**Article Description:** ${article.description}` : ''}

**Tweets to classify:**

${tweetList}

**Classification Criteria:**

LEFT:
- Pro-Democrat, progressive policies
- Support for social justice, climate action, labor rights
- Critical of Republicans/conservatives
- Hashtags: #DemSocialist, #GreenNewDeal, #Medicare4All, etc.
- Language: "corporate greed", "tax the rich", "workers' rights"

RIGHT:
- Pro-Republican, conservative values
- Support for limited government, traditional values, business-first policies
- Critical of Democrats/progressives
- Hashtags: #MAGA, #America First, #2A, #ProLife, etc.
- Language: "freedom", "liberty", "small government", "free market"

CENTER:
- Neutral/balanced perspective
- Fact-focused without partisan framing
- Bipartisan or non-political
- Ambiguous lean or no clear political position

**Response Format:**
{
  "classifications": [
    {
      "tweetIndex": 1,
      "lean": "left|center|right",
      "confidence": 0.0-1.0,
      "reasoning": "Brief explanation (20 words max)"
    },
    ...
  ]
}

**Important:**
- Classify ALL ${tweets.length} tweets
- Consider author profile, language/framing, hashtags, sentiment
- Confidence: 0.8-1.0 = very clear, 0.5-0.8 = moderate, 0.0-0.5 = uncertain
- Keep reasoning concise (under 20 words)

Return ONLY valid JSON, no additional text.`;
}

// ============================================================================
// Tweet Distribution Logic
// ============================================================================

/**
 * Distribute tweets into LEFT/CENTER/RIGHT categories
 * Goal: 3 tweets per lean (9 total)
 * 
 * Algorithm:
 * 1. Sort by confidence (high → low)
 * 2. Pick top 3 per lean
 * 3. Fill gaps with remaining high-confidence tweets
 * 
 * @param classifications - Classification results from AI
 * @param tweets - Original tweets
 * @returns Object with left/center/right tweet arrays
 */
export function distributeTweets(
  classifications: TweetClassification[],
  tweets: TwitterApiTweet[]
): DistributedTweets {
  // Sort by confidence (highest first)
  const sorted = [...classifications].sort((a, b) => b.confidence - a.confidence);

  const left: TwitterApiTweet[] = [];
  const center: TwitterApiTweet[] = [];
  const right: TwitterApiTweet[] = [];

  // First pass: Fill by lean (up to 3 per category)
  for (const classification of sorted) {
    const tweet = tweets[classification.tweetIndex];
    if (!tweet) continue;

    if (classification.lean === 'left' && left.length < 3) {
      left.push(tweet);
    } else if (classification.lean === 'center' && center.length < 3) {
      center.push(tweet);
    } else if (classification.lean === 'right' && right.length < 3) {
      right.push(tweet);
    }
  }

  // Second pass: Fill gaps with remaining tweets (prioritize center first for balance)
  const remaining = sorted.filter(c => {
    const tweet = tweets[c.tweetIndex];
    return !left.includes(tweet) && !center.includes(tweet) && !right.includes(tweet);
  });

  for (const classification of remaining) {
    const tweet = tweets[classification.tweetIndex];
    if (!tweet) continue;

    // Fill in order: left → right → center (to maintain balance)
    if (left.length < 3) {
      left.push(tweet);
    } else if (right.length < 3) {
      right.push(tweet);
    } else if (center.length < 3) {
      center.push(tweet);
    }

    // Stop when all categories full
    if (left.length >= 3 && center.length >= 3 && right.length >= 3) {
      break;
    }
  }

  return { left, center, right };
}

// ============================================================================
// Helper: Generate Viewpoint Summary
// ============================================================================

/**
 * Generate a summary for a viewpoint based on its tweets
 * 
 * @param lean - Political lean (left/center/right)
 * @param tweets - Tweets in this lean
 * @returns Summary text
 */
export function generateViewpointSummary(
  lean: 'left' | 'center' | 'right',
  tweets: TwitterApiTweet[]
): string {
  if (tweets.length === 0) {
    return `No ${lean} perspective tweets found.`;
  }

  // Extract common themes from tweet text
  const allText = tweets.map(t => t.text).join(' ');
  
  // Simple summary based on lean
  const leanLabels = {
    left: 'Progressive',
    center: 'Balanced',
    right: 'Conservative'
  };

  return `${leanLabels[lean]} perspective from ${tweets.length} ${tweets.length === 1 ? 'tweet' : 'tweets'}. ${tweets[0].text.substring(0, 100)}...`;
}

// ============================================================================
// Helper: Calculate Sentiment Score
// ============================================================================

/**
 * Calculate aggregate sentiment score for a viewpoint
 * Based on engagement metrics (likes + retweets)
 * 
 * @param tweets - Tweets in this viewpoint
 * @returns Sentiment score (-1 to +1)
 */
export function calculateSentimentScore(tweets: TwitterApiTweet[]): number {
  if (tweets.length === 0) return 0;

  // Simple engagement-based score
  const totalEngagement = tweets.reduce((sum, t) => sum + t.likeCount + t.retweetCount, 0);
  const avgEngagement = totalEngagement / tweets.length;

  // Normalize to -1 to +1 range (higher engagement = more positive)
  // Using log scale to handle viral tweets
  const normalizedScore = Math.log10(avgEngagement + 1) / 5; // Divide by 5 to keep in reasonable range

  return Math.max(-1, Math.min(1, normalizedScore));
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Convenience function: Classify and distribute tweets in one call
 * 
 * @param article - Article metadata
 * @param tweets - Tweets to classify
 * @returns Distributed tweets (left/center/right)
 */
export async function classifyAndDistribute(
  article: { title: string; description?: string },
  tweets: TwitterApiTweet[]
): Promise<DistributedTweets> {
  if (tweets.length === 0) {
    return { left: [], center: [], right: [] };
  }

  const classifications = await classifyTweets(article, tweets);
  return distributeTweets(classifications, tweets);
}

export default {
  classifyTweets,
  distributeTweets,
  generateViewpointSummary,
  calculateSentimentScore,
  classifyAndDistribute
};
