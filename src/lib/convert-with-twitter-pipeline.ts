/**
 * Convert Newsdata.io Article to OmniDoxa Story with Twitter Sentiment Pipeline
 * 
 * Replaces grok4-sentiment-direct.ts with new Twitter integration
 * Flow: Article → Twitter Search → AI Classification → Database
 */

import type { NewsdataArticle } from './newsdata';
import type { StoryWithViewpoints, Category } from './types';
import {
  runSentimentPipeline,
  generateKeywordFallback,
  type SentimentPipelineResult
} from './sentiment-pipeline';

/**
 * Ensure category is valid (type-safe)
 */
function ensureValidCategory(cat: string): Category {
  const validCategories: Category[] = ['breaking', 'business', 'crime', 'entertainment', 'politics', 'science', 'top', 'world', 'technology', 'domestic'];
  return validCategories.includes(cat as Category) ? (cat as Category) : 'top';
}

/**
 * Convert a Newsdata.io article to an OmniDoxa story with Twitter sentiment
 * 
 * @param article - Raw article from Newsdata.io
 * @param displayOrder - Display order for frontend
 * @param category - Article category
 * @returns Complete story with viewpoints and tweets
 */
export async function convertToStoryWithTwitterPipeline(
  article: NewsdataArticle,
  displayOrder: number,
  category: string
): Promise<StoryWithViewpoints> {
  console.log(`\n🔄 Converting article #${displayOrder}: ${article.title.substring(0, 60)}...`);

  // Step 1: Run sentiment pipeline (fetch tweets + classify)
  const pipelineResult = await runSentimentPipeline({
    title: article.title,
    description: article.description || undefined,
    category
  });

  // Step 2: Handle fallback if pipeline failed
  let viewpoints = pipelineResult.viewpoints;
  if (!pipelineResult.success || pipelineResult.tweetCount === 0) {
    console.warn(`  ⚠️  Pipeline failed or no tweets - using fallback`);
    viewpoints = generateKeywordFallback({
      title: article.title,
      description: article.description || undefined,
      category
    });
  }

  // Step 3: Build complete story object
  const story: StoryWithViewpoints = {
    id: 0, // Will be set by database
    title: article.title,
    description: article.description || '',
    url: article.link,
    source: article.source_name || 'Unknown',
    image_url: article.image_url || null,
    category: ensureValidCategory(category),
    published_at: article.pubDate || new Date().toISOString(),
    fetched_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    viewpoints
  };

  console.log(`  ✅ Converted with ${pipelineResult.tweetCount} tweets from ${pipelineResult.source}`);

  return story;
}

/**
 * Batch convert multiple articles with progress logging
 * 
 * @param articles - Array of articles to convert
 * @param category - Category for all articles
 * @returns Array of stories with viewpoints
 */
export async function batchConvertArticles(
  articles: NewsdataArticle[],
  category: string
): Promise<StoryWithViewpoints[]> {
  const stories: StoryWithViewpoints[] = [];

  console.log(`\n📦 Batch converting ${articles.length} ${category} articles...`);

  for (let i = 0; i < articles.length; i++) {
    try {
      const story = await convertToStoryWithTwitterPipeline(
        articles[i],
        i + 1,
        category
      );
      stories.push(story);

      // Progress update
      console.log(`  [${i + 1}/${articles.length}] ✅ ${articles[i].title.substring(0, 50)}...`);

      // Rate limiting: 2 seconds between articles
      if (i < articles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`  [${i + 1}/${articles.length}] ❌ Failed:`, error);
      // Continue with next article
    }
  }

  console.log(`\n✅ Batch conversion complete: ${stories.length}/${articles.length} successful`);

  return stories;
}

export default {
  convertToStoryWithTwitterPipeline,
  batchConvertArticles
};
