/**
 * Convert Newsdata.io Article to OmniDoxa Story with Grok Responses Pipeline
 *
 * Flow: Article → xAI Responses API (x_search + web_search) → Database
 * Fallback: keyword-based sentiment when xAI is unavailable
 */

import type { NewsdataArticle } from './newsdata';
import type { StoryWithViewpoints, Category } from './types';
import { generateKeywordFallback } from './sentiment-pipeline';
import { analyzeWithGrokResponses } from './grok-responses';

/**
 * Ensure category is valid (type-safe)
 */
function ensureValidCategory(cat: string): Category {
  const validCategories: Category[] = [
    'breaking', 'business', 'crime', 'entertainment', 'politics',
    'science', 'top', 'world', 'technology', 'domestic'
  ];
  return validCategories.includes(cat as Category) ? (cat as Category) : 'top';
}

/**
 * Convert a Newsdata.io article to an OmniDoxa story with xAI sentiment analysis.
 *
 * Primary path: xAI Responses API with x_search + web_search (real X posts, is_real: true)
 * Fallback path: keyword-based stubs (is_real: false, no posts)
 *
 * @param article - Raw article from Newsdata.io
 * @param displayOrder - Display order for frontend
 * @param category - Article category
 * @returns Complete story with viewpoints and social posts
 */
export async function convertToStoryWithTwitterPipeline(
  article: NewsdataArticle,
  displayOrder: number,
  category: string
): Promise<StoryWithViewpoints> {
  console.log(`\n🔄 Converting article #${displayOrder}: ${article.title.substring(0, 60)}...`);

  let viewpoints: StoryWithViewpoints['viewpoints'];
  let tweetCount = 0;

  try {
    // Primary path: xAI Responses API with x_search
    console.log(`  🤖 Analyzing with xAI Responses API (x_search + web_search)...`);
    const analysis = await analyzeWithGrokResponses(article);

    viewpoints = analysis.viewpoints;
    tweetCount = viewpoints.reduce((sum, vp) => sum + vp.social_posts.length, 0);

    console.log(`  ✅ xAI analysis complete — ${tweetCount} real posts found`);

    // Build and return the story with real posts
    const story: StoryWithViewpoints = {
      id: 0,
      title: article.title,
      description: analysis.nonBiasedSummary || article.description || '',
      url: article.link,
      source: article.source_name || 'Unknown',
      image_url: article.image_url || null,
      category: ensureValidCategory(category),
      published_at: article.pubDate || new Date().toISOString(),
      fetched_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      viewpoints
    };

    console.log(`  ✅ Converted with ${tweetCount} real posts from xAI`);
    return story;

  } catch (err) {
    // Fallback path: no posts, show "no relevant posts found" note
    const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.message?.includes('abort'));
    console.warn(`  ⚠️  xAI analysis ${isTimeout ? 'timed out (>120s)' : 'failed'} — saving placeholder`);

    const note = isTimeout
      ? 'Analysis timed out — no relevant posts found at this time.'
      : 'Analysis unavailable — no relevant posts found at this time.';

    viewpoints = (['left', 'center', 'right'] as const).map((lean, i) => ({
      id: 0,
      story_id: 0,
      lean,
      summary: note,
      sentiment_score: 0,
      social_posts: [],
      created_at: new Date().toISOString()
    }));
    tweetCount = 0;

    const story: StoryWithViewpoints = {
      id: 0,
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

    console.log(`  ✅ Converted with keyword fallback (0 real posts)`);
    return story;
  }
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

      console.log(
        `  [${i + 1}/${articles.length}] ✅ ${articles[i].title.substring(0, 50)}...`
      );

      // Rate limiting: 2 seconds between articles
      if (i < articles.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`  [${i + 1}/${articles.length}] ❌ Failed:`, error);
      // Continue with next article
    }
  }

  console.log(
    `\n✅ Batch conversion complete: ${stories.length}/${articles.length} successful`
  );

  return stories;
}

export default {
  convertToStoryWithTwitterPipeline,
  batchConvertArticles
};
