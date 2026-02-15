/**
 * Phase 2: twitterapi.io + Grok AI Classification
 */
import type { StoryWithViewpoints } from './types';
import type { NewsdataArticle } from './newsdata';
import { searchArticleTweets, type TwitterApiTweet } from './twitterapi-io';
import { classifyTweets, distributeTweets } from './tweet-classifier';

export async function convertPhase2(
  article: NewsdataArticle,
  id: number,
  cat: string
): Promise<StoryWithViewpoints> {
  console.log(`\n🐦 [P2] ${article.title.substring(0, 50)}...`);
  
  try {
    const tweets = await searchArticleTweets(article.title, 20);
    if (tweets.length === 0) return fallback(article, id, cat);
    
    console.log(`  ✅ ${tweets.length} tweets`);
    
    const classifications = await classifyTweets(article, tweets);
    const dist = distributeTweets(classifications, tweets);
    
    console.log(`  📊 L:${dist.left.length} C:${dist.center.length} R:${dist.right.length}`);
    
    return build(article, id, cat, dist);
  } catch (e) {
    console.error(`  ❌`, e);
    return fallback(article, id, cat);
  }
}

function build(a: NewsdataArticle, id: number, cat: string, d: any) {
  return {
    id,
    title: a.title,
    description: a.description || a.title,
    url: a.link,
    source: a.source_name,
    image_url: a.image_url,
    category: cat as any,
    published_at: a.pubDate,
    fetched_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    viewpoints: [
      vp('left', id, d.left),
      vp('center', id, d.center),
      vp('right', id, d.right)
    ]
  };
}

function vp(lean: 'left'|'center'|'right', sid: number, tweets: TwitterApiTweet[]) {
  const vid = sid * 3 + (lean === 'left' ? 0 : lean === 'center' ? 1 : 2);
  return {
    id: vid,
    story_id: sid,
    lean,
    summary: tweets[0] ? `@${tweets[0].author.userName}: "${tweets[0].text.substring(0, 80)}..."` : 'No tweets',
    sentiment_score: 0,
    social_posts: tweets.map((t, i) => ({
      id: vid * 10 + i,
      viewpoint_id: vid,
      author: t.author.name,
      author_handle: `@${t.author.userName}`,
      text: t.text,
      url: t.url,
      platform: 'twitter',
      likes: t.likeCount,
      retweets: t.retweetCount,
      created_at: new Date().toISOString()
    })),
    created_at: new Date().toISOString()
  };
}

function fallback(a: NewsdataArticle, id: number, cat: string) {
  return {
    id,
    title: a.title,
    description: a.description || a.title,
    url: a.link,
    source: a.source_name,
    image_url: a.image_url,
    category: cat as any,
    published_at: a.pubDate,
    fetched_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    viewpoints: [
      { id: id*3, story_id: id, lean: 'left' as const, summary: 'No tweets', sentiment_score: 0, social_posts: [], created_at: new Date().toISOString() },
      { id: id*3+1, story_id: id, lean: 'center' as const, summary: a.description || a.title, sentiment_score: 0, social_posts: [], created_at: new Date().toISOString() },
      { id: id*3+2, story_id: id, lean: 'right' as const, summary: 'No tweets', sentiment_score: 0, social_posts: [], created_at: new Date().toISOString() }
    ]
  };
}
