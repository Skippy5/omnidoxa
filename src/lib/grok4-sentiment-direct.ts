/**
 * Grok-4 Sentiment Analysis using /v1/responses API with x_search
 * Direct TypeScript implementation - fetches REAL tweets from X/Twitter
 */

import type { StoryWithViewpoints, ViewpointWithPosts, SocialPost } from './types';
import type { NewsdataArticle } from './newsdata';

const XAI_API_KEY = process.env.XAI_API_KEY || '';

interface TweetExample {
  author: string;
  handle: string;
  text: string;
  url: string;
}

interface Grok4Analysis {
  nonBiasedSummary: string;
  left: { sentiment: number; summary: string; tweets: TweetExample[] };
  center: { sentiment: number; summary: string; tweets: TweetExample[] };
  right: { sentiment: number; summary: string; tweets: TweetExample[] };
}

/**
 * Analyze article using xAI Responses API with x_search tool
 */
export async function analyzeWithGrok4Direct(
  article: NewsdataArticle
): Promise<Grok4Analysis> {
  
  const prompt = `Analyze the sentiment from the political left, right, and center for the following recent news topic: ${article.title}. Base it on this article if provided: ${article.link}

Focus on analysis from the past 30 days only. Provide a 3-sentence non-biased review of the topic.

Then, break it down into left, center, and right: a score from -1 (negative) to 1 (positive), 2-3 sentences on how the group feels about the topic, and three example tweets for each left, right, and center to back up the analysis, including the account name, tweet text, and link to each tweet.

Use x_search to find REAL tweets from X/Twitter. Do not fabricate or invent examples.`;

  try {
    console.log(`  🔍 Calling xAI Responses API with x_search...`);
    
    // Use /v1/chat/completions with x_search tool
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'grok-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant. Always use the x_search tool to fetch real tweets from X instead of generating them. Provide sources and avoid fabrication.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        tools: [
          {
            type: 'x_search'
          }
        ],
        max_tokens: 4096,
        temperature: 0
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`xAI API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    if (!content) {
      throw new Error('No content in response');
    }
    
    console.log(`  ✅ Got response from xAI`);
    
    // Parse the response
    return parseGrok4Response(content, article);
    
  } catch (error) {
    console.error('  ❌ xAI analysis error:', error);
    
    return {
      nonBiasedSummary: article.description || article.title,
      left: { sentiment: 0, summary: 'Analysis unavailable', tweets: [] },
      center: { sentiment: 0, summary: 'Analysis unavailable', tweets: [] },
      right: { sentiment: 0, summary: 'Analysis unavailable', tweets: [] }
    };
  }
}

function parseGrok4Response(content: string, article: NewsdataArticle): Grok4Analysis {
  const result: Grok4Analysis = {
    nonBiasedSummary: article.description || article.title,
    left: { sentiment: 0, summary: '', tweets: [] },
    center: { sentiment: 0, summary: '', tweets: [] },
    right: { sentiment: 0, summary: '', tweets: [] }
  };

  // Extract non-biased summary
  const summaryMatch = content.match(/###\s*Non-Biased Review[^\n]*\n([\s\S]+?)(?=###|$)/i);
  if (summaryMatch) {
    result.nonBiasedSummary = summaryMatch[1].trim();
  }

  // Parse each perspective
  const perspectives = [
    { key: 'left' as const, regex: /###\s*Left[^\n]*\n\*\*Score:\*\*\s*([-\d.]+)[^\n]*\n([\s\S]+?)(?=\*\*Example Tweets:\*\*|###|$)/i },
    { key: 'center' as const, regex: /###\s*Center[^\n]*\n\*\*Score:\*\*\s*([-\d.]+)[^\n]*\n([\s\S]+?)(?=\*\*Example Tweets:\*\*|###|$)/i },
    { key: 'right' as const, regex: /###\s*Right[^\n]*\n\*\*Score:\*\*\s*([-\d.]+)[^\n]*\n([\s\S]+?)(?=\*\*Example Tweets:\*\*|###|$)/i }
  ];

  for (const { key, regex } of perspectives) {
    const match = content.match(regex);
    if (match) {
      result[key].sentiment = parseFloat(match[1]);
      result[key].summary = match[2].trim();
    }

    // Extract tweets for this perspective
    const sectionRegex = new RegExp(`###\\s*${key === 'left' ? 'Left' : key === 'center' ? 'Center' : 'Right'}[^]*?\\*\\*Example Tweets:\\*\\*([^]*?)(?=###|$)`, 'i');
    const sectionMatch = content.match(sectionRegex);
    
    if (sectionMatch) {
      const tweetsText = sectionMatch[1];
      const tweetPattern = /\d+\.\s+\*\*Account:\*\*\s*([^\n]+)\s+\*\*Tweet Text:\*\*\s*([^\n]+)\s+\*\*Link:\*\*\s*(https?:\/\/[^\s]+)/g;
      
      let tweetMatch;
      while ((tweetMatch = tweetPattern.exec(tweetsText)) !== null) {
        const account = tweetMatch[1].trim();
        const handle = account.startsWith('@') ? account : `@${account.split('(')[0].trim()}`;
        
        result[key].tweets.push({
          author: account,
          handle: handle,
          text: tweetMatch[2].trim().replace(/^"|"$/g, ''),
          url: tweetMatch[3].trim()
        });
      }
    }
  }

  const totalTweets = result.left.tweets.length + result.center.tweets.length + result.right.tweets.length;
  console.log(`  📊 Parsed: ${totalTweets} tweets (L:${result.left.tweets.length} C:${result.center.tweets.length} R:${result.right.tweets.length})`);

  return result;
}

function ensureValidCategory(cat: string): 'breaking' | 'business' | 'crime' | 'entertainment' | 'politics' | 'science' | 'top' | 'world' {
  const validCategories = ['breaking', 'business', 'crime', 'entertainment', 'politics', 'science', 'top', 'world'] as const;
  return validCategories.includes(cat as any) ? cat as any : 'top';
}

export async function convertToStoryWithGrok4Direct(
  article: NewsdataArticle,
  storyId: number,
  intendedCategory?: string
): Promise<StoryWithViewpoints> {
  const analysis = await analyzeWithGrok4Direct(article);
  
  const convertTweets = (tweets: TweetExample[]): SocialPost[] => {
    return tweets.map((tweet, idx) => ({
      id: storyId * 100 + idx,
      viewpoint_id: 0,
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
    socialPosts.forEach(post => { post.viewpoint_id = viewpointId; });
    
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
