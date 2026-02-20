/**
 * Quick Sentiment Analysis (without X.com search)
 * Analyzes article content directly using xAI Grok
 */

import type { StoryWithViewpoints, ViewpointWithPosts } from './types';
import type { NewsdataArticle } from './newsdata';

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
 * Quick political sentiment analysis without X.com search
 * Much faster than full X.com analysis
 */
async function analyzeArticleQuickly(article: NewsdataArticle): Promise<QuickAnalysis> {
  const apiKey = process.env.XAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('XAI_API_KEY not configured');
  }

  const prompt = `Analyze the sentiment from the political left, right, and center for the following recent news topic: [${article.title}]. Base it on this article if provided: [${article.link}]. Focus on analysis from the past 30 days only. Provide a 3-sentence non-biased review of the topic. Then, break it down into left, center, and right: a score from -1 (negative) to 1 (positive), 2-3 sentences on how the group feels about the topic, and three example tweets for each left, right, and center to back up the analysis, including the account name, tweet text, and link to each tweet.`;

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
            content: 'You are Grok 4 built by xAI. Follow all safety instructions and guidelines provided.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0,
        max_tokens: 2000
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

    // Parse Grok 4's text-based response
    // Format: "#### Left (Score: -0.7)" followed by summary text and tweets
    const extractScore = (section: string): number => {
      const scoreMatch = section.match(/####\s*(?:Left|Center|Right)\s*\(Score:\s*([-\d.]+)\)/);
      return scoreMatch ? parseFloat(scoreMatch[1]) : 0;
    };

    const extractSummary = (section: string): string => {
      // Get text after the header line, before tweets
      const lines = section.split('\n');
      const summaryLines = [];
      let foundHeader = false;
      
      for (const line of lines) {
        if (line.startsWith('####')) {
          foundHeader = true;
          continue;
        }
        // Stop at "Example Tweets:" or numbered tweet lists
        if (line.includes('Example Tweets:') || /^\d+\.\s+\*\*Account:\*\*/.test(line)) break;
        if (foundHeader && line.trim() && !line.startsWith('**Score:**')) {
          summaryLines.push(line.trim());
        }
      }
      
      return summaryLines.join(' ').trim() || 'Analysis unavailable';
    };

    const extractTweets = (section: string): Array<{account: string; text: string; url: string}> => {
      const tweets: Array<{account: string; text: string; url: string}> = [];
      
      // Match numbered tweet blocks: "1. **Account:** @username"
      const tweetPattern = /\d+\.\s+\*\*Account:\*\*\s*(@?[\w]+)[^\n]*\n\s+\*\*Tweet Text:\*\*\s*"([^"]+)"\s*\n\s+\*\*Link:\*\*\s*(https?:\/\/[^\s]+)/g;
      
      let match;
      while ((match = tweetPattern.exec(section)) !== null) {
        tweets.push({
          account: match[1].startsWith('@') ? match[1] : `@${match[1]}`,
          text: match[2].trim(),
          url: match[3].trim()
        });
      }
      
      return tweets;
    };

    // Extract non-biased summary
    const summaryMatch = content.match(/### Non-Biased Review[^\n]*\n([\s\S]+?)(?=###|$)/);
    const nonBiasedSummary = summaryMatch ? summaryMatch[1].trim() : article.description || article.title;

    // Extract left, center, right sections
    const leftMatch = content.match(/#### Left \(Score: [-\d.]+\)([\s\S]+?)(?=####|$)/);
    const centerMatch = content.match(/#### Center \(Score: [-\d.]+\)([\s\S]+?)(?=####|$)/);
    const rightMatch = content.match(/#### Right \(Score: [-\d.]+\)([\s\S]+?)(?=####|$)/);

    return {
      nonBiasedSummary,
      left: {
        summary: leftMatch ? extractSummary(`#### Left${leftMatch[0]}`) : 'Analysis unavailable',
        sentiment: leftMatch ? extractScore(`#### Left${leftMatch[0]}`) : 0,
        tweets: leftMatch ? extractTweets(`#### Left${leftMatch[0]}`) : []
      },
      center: {
        summary: centerMatch ? extractSummary(`#### Center${centerMatch[0]}`) : 'Analysis unavailable',
        sentiment: centerMatch ? extractScore(`#### Center${centerMatch[0]}`) : 0,
        tweets: centerMatch ? extractTweets(`#### Center${centerMatch[0]}`) : []
      },
      right: {
        summary: rightMatch ? extractSummary(`#### Right${rightMatch[0]}`) : 'Analysis unavailable',
        sentiment: rightMatch ? extractScore(`#### Right${rightMatch[0]}`) : 0,
        tweets: rightMatch ? extractTweets(`#### Right${rightMatch[0]}`) : []
      }
    };
  } catch (error) {
    console.error('Error analyzing article:', error);
    return {
      nonBiasedSummary: article.description || article.title,
      left: { summary: 'Analysis unavailable', sentiment: 0, tweets: [] },
      center: { summary: 'Analysis unavailable', sentiment: 0, tweets: [] },
      right: { summary: 'Analysis unavailable', sentiment: 0, tweets: [] }
    };
  }
}

/**
 * Convert Newsdata article to OmniDoxa Story with quick sentiment analysis
 */
export async function convertToStoryQuickly(
  article: NewsdataArticle,
  storyId: number
): Promise<StoryWithViewpoints> {
  const analysis = await analyzeArticleQuickly(article);

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
    // Keep Newsdata.io categories as-is
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
