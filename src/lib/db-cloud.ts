import { turso } from './db-turso';
import type { Story, Viewpoint, SocialPost, StoryWithViewpoints, ViewpointWithPosts, Category } from './types';

/**
 * Cloud database layer using Turso (async libSQL client)
 * All functions are async and use await for database operations
 */

export async function getAllStories(category?: Category): Promise<StoryWithViewpoints[]> {
  let result;
  
  if (category) {
    result = await turso.execute({
      sql: 'SELECT * FROM stories WHERE category = ? ORDER BY published_at DESC',
      args: [category]
    });
  } else {
    result = await turso.execute('SELECT * FROM stories ORDER BY published_at DESC');
  }

  const stories = result.rows as unknown as Story[];
  
  // Enrich each story with viewpoints
  const enriched = await Promise.all(
    stories.map(story => enrichStoryWithViewpoints(story))
  );
  
  return enriched;
}

export async function getStoryById(id: number): Promise<StoryWithViewpoints | null> {
  const result = await turso.execute({
    sql: 'SELECT * FROM stories WHERE id = ?',
    args: [id]
  });

  if (result.rows.length === 0) return null;
  
  const story = result.rows[0] as unknown as Story;
  return enrichStoryWithViewpoints(story);
}

async function enrichStoryWithViewpoints(story: Story): Promise<StoryWithViewpoints> {
  const vpResult = await turso.execute({
    sql: 'SELECT * FROM viewpoints WHERE story_id = ? ORDER BY lean',
    args: [story.id]
  });

  const viewpoints = vpResult.rows as unknown as Viewpoint[];

  const viewpointsWithPosts: ViewpointWithPosts[] = await Promise.all(
    viewpoints.map(async (vp) => {
      const postsResult = await turso.execute({
        sql: 'SELECT * FROM social_posts WHERE viewpoint_id = ? ORDER BY likes DESC',
        args: [vp.id]
      });

      const socialPosts = (postsResult.rows as unknown as (Omit<SocialPost, 'is_real'> & { is_real: number })[]).map(
        (row) => ({ ...row, is_real: Boolean(row.is_real) }) as SocialPost
      );

      return { ...vp, social_posts: socialPosts };
    })
  );

  return { ...story, viewpoints: viewpointsWithPosts };
}

export async function upsertStory(story: Omit<Story, 'id' | 'created_at'>): Promise<number> {
  const existingResult = await turso.execute({
    sql: 'SELECT id FROM stories WHERE url = ?',
    args: [story.url]
  });

  if (existingResult.rows.length > 0) {
    const existing = existingResult.rows[0] as { id: number };
    
    await turso.execute({
      sql: `UPDATE stories SET title = ?, description = ?, source = ?, image_url = ?, category = ?, published_at = ?, fetched_at = ?
            WHERE id = ?`,
      args: [story.title, story.description, story.source, story.image_url, story.category, story.published_at, story.fetched_at, existing.id]
    });
    
    return existing.id;
  }

  const result = await turso.execute({
    sql: `INSERT INTO stories (title, description, url, source, image_url, category, published_at, fetched_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [story.title, story.description, story.url, story.source, story.image_url, story.category, story.published_at, story.fetched_at]
  });

  return Number(result.lastInsertRowid);
}

export async function getLastFetchTime(): Promise<string | null> {
  const result = await turso.execute('SELECT MAX(fetched_at) as last_fetch FROM stories');
  const row = result.rows[0] as { last_fetch: string | null };
  return row?.last_fetch ?? null;
}

export async function clearCategoryArticles(category: Category): Promise<number> {
  // Delete in reverse order (FK constraints)
  
  // 1. Delete social_posts for this category's stories
  await turso.execute({
    sql: `DELETE FROM social_posts 
          WHERE viewpoint_id IN (
            SELECT v.id FROM viewpoints v 
            JOIN stories s ON v.story_id = s.id 
            WHERE s.category = ?
          )`,
    args: [category]
  });
  
  // 2. Delete viewpoints for this category's stories
  await turso.execute({
    sql: `DELETE FROM viewpoints 
          WHERE story_id IN (SELECT id FROM stories WHERE category = ?)`,
    args: [category]
  });
  
  // 3. Delete stories for this category
  const result = await turso.execute({
    sql: 'DELETE FROM stories WHERE category = ?',
    args: [category]
  });
  
  return result.rowsAffected;
}

export async function saveStoryWithViewpoints(story: StoryWithViewpoints): Promise<number> {
  // Turso doesn't support transaction callbacks, use batch or explicit BEGIN/COMMIT
  // For now, we'll use sequential operations (Turso handles consistency on serverless edge)
  
  // Upsert story
  const storyId = await upsertStory({
    title: story.title,
    description: story.description,
    url: story.url,
    source: story.source,
    image_url: story.image_url,
    category: story.category,
    published_at: story.published_at,
    fetched_at: story.fetched_at
  });
  
  // Delete old viewpoints and social posts for this story
  await turso.execute({
    sql: 'DELETE FROM social_posts WHERE viewpoint_id IN (SELECT id FROM viewpoints WHERE story_id = ?)',
    args: [storyId]
  });
  
  await turso.execute({
    sql: 'DELETE FROM viewpoints WHERE story_id = ?',
    args: [storyId]
  });
  
  // Insert viewpoints and social posts
  for (const viewpoint of story.viewpoints) {
    const vpResult = await turso.execute({
      sql: `INSERT INTO viewpoints (story_id, lean, summary, sentiment_score)
            VALUES (?, ?, ?, ?)`,
      args: [storyId, viewpoint.lean, viewpoint.summary, viewpoint.sentiment_score]
    });
    
    const viewpointId = Number(vpResult.lastInsertRowid);
    
    // Insert social posts
    for (const post of viewpoint.social_posts) {
      await turso.execute({
        sql: `INSERT INTO social_posts (viewpoint_id, author, author_handle, text, url, platform, likes, retweets, is_real, post_date)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          viewpointId,
          post.author,
          post.author_handle,
          post.text,
          post.url,
          post.platform,
          post.likes,
          post.retweets,
          post.is_real ? 1 : 0,
          post.post_date ?? null
        ]
      });
    }
  }
  
  return storyId;
}

export async function hasStories(): Promise<boolean> {
  const result = await turso.execute('SELECT COUNT(*) as count FROM stories');
  const row = result.rows[0] as { count: number };
  return row.count > 0;
}
