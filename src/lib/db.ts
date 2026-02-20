import Database from 'better-sqlite3';
import path from 'path';
import { initializeDatabase } from './schema';
import type { Story, Viewpoint, SocialPost, StoryWithViewpoints, ViewpointWithPosts, Category } from './types';

const DB_PATH = path.join(process.cwd(), 'omnidoxa.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    initializeDatabase(_db);
  }
  return _db;
}

export function getAllStories(category?: Category): StoryWithViewpoints[] {
  const db = getDb();

  let stories: Story[];
  if (category) {
    stories = db.prepare('SELECT * FROM stories WHERE category = ? ORDER BY published_at DESC').all(category) as Story[];
  } else {
    stories = db.prepare('SELECT * FROM stories ORDER BY published_at DESC').all() as Story[];
  }

  return stories.map((story) => enrichStoryWithViewpoints(db, story));
}

export function getStoryById(id: number): StoryWithViewpoints | null {
  const db = getDb();
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(id) as Story | undefined;
  if (!story) return null;
  return enrichStoryWithViewpoints(db, story);
}

function enrichStoryWithViewpoints(db: Database.Database, story: Story): StoryWithViewpoints {
  const viewpoints = db.prepare('SELECT * FROM viewpoints WHERE story_id = ? ORDER BY lean').all(story.id) as Viewpoint[];

  const viewpointsWithPosts: ViewpointWithPosts[] = viewpoints.map((vp) => {
    // SQLite stores is_real as INTEGER (0/1); coerce to boolean here so TypeScript
    // consumers get the correct type rather than a raw number.
    const socialPosts = (db.prepare('SELECT * FROM social_posts WHERE viewpoint_id = ? ORDER BY likes DESC').all(vp.id) as (Omit<SocialPost, 'is_real'> & { is_real: number })[]).map(
      (row) => ({ ...row, is_real: Boolean(row.is_real) }) as SocialPost
    );
    return { ...vp, social_posts: socialPosts };
  });

  return { ...story, viewpoints: viewpointsWithPosts };
}

export function upsertStory(story: Omit<Story, 'id' | 'created_at'>): number {
  const db = getDb();

  const existing = db.prepare('SELECT id FROM stories WHERE url = ?').get(story.url) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE stories SET title = ?, description = ?, source = ?, image_url = ?, category = ?, published_at = ?, fetched_at = ?
      WHERE id = ?
    `).run(story.title, story.description, story.source, story.image_url, story.category, story.published_at, story.fetched_at, existing.id);
    return existing.id;
  }

  const result = db.prepare(`
    INSERT INTO stories (title, description, url, source, image_url, category, published_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(story.title, story.description, story.url, story.source, story.image_url, story.category, story.published_at, story.fetched_at);

  return Number(result.lastInsertRowid);
}

export function getLastFetchTime(): string | null {
  const db = getDb();
  const row = db.prepare('SELECT MAX(fetched_at) as last_fetch FROM stories').get() as { last_fetch: string | null };
  return row?.last_fetch ?? null;
}

/**
 * Clear all articles for a specific category
 * Use before fetching fresh articles to prevent accumulation
 */
export function clearCategoryArticles(category: Category): number {
  const db = getDb();
  
  // Delete in reverse order (FK constraints)
  // 1. Delete social_posts for this category's stories
  db.prepare(`
    DELETE FROM social_posts 
    WHERE viewpoint_id IN (
      SELECT v.id FROM viewpoints v 
      JOIN stories s ON v.story_id = s.id 
      WHERE s.category = ?
    )
  `).run(category);
  
  // 2. Delete viewpoints for this category's stories
  db.prepare(`
    DELETE FROM viewpoints 
    WHERE story_id IN (SELECT id FROM stories WHERE category = ?)
  `).run(category);
  
  // 3. Delete stories for this category
  const result = db.prepare('DELETE FROM stories WHERE category = ?').run(category);
  
  return result.changes;
}

/**
 * Save a complete story with viewpoints and tweets to the database
 */
export function saveStoryWithViewpoints(story: StoryWithViewpoints): number {
  const db = getDb();
  
  // Start transaction
  const saveStory = db.transaction((storyData: StoryWithViewpoints) => {
    // Upsert story
    const storyId = upsertStory({
      title: storyData.title,
      description: storyData.description,
      url: storyData.url,
      source: storyData.source,
      image_url: storyData.image_url,
      category: storyData.category,
      published_at: storyData.published_at,
      fetched_at: storyData.fetched_at
    });
    
    // Delete old viewpoints and social posts for this story
    db.prepare('DELETE FROM social_posts WHERE viewpoint_id IN (SELECT id FROM viewpoints WHERE story_id = ?)').run(storyId);
    db.prepare('DELETE FROM viewpoints WHERE story_id = ?').run(storyId);
    
    // Insert viewpoints and social posts
    for (const viewpoint of storyData.viewpoints) {
      const vpResult = db.prepare(`
        INSERT INTO viewpoints (story_id, lean, summary, sentiment_score)
        VALUES (?, ?, ?, ?)
      `).run(storyId, viewpoint.lean, viewpoint.summary, viewpoint.sentiment_score);
      
      const viewpointId = Number(vpResult.lastInsertRowid);
      
      // Insert social posts
      for (const post of viewpoint.social_posts) {
        db.prepare(`
          INSERT INTO social_posts (viewpoint_id, author, author_handle, text, url, platform, likes, retweets, is_real, post_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          viewpointId,
          post.author,
          post.author_handle,
          post.text,
          post.url,
          post.platform,
          post.likes,
          post.retweets,
          post.is_real ? 1 : 0,  // boolean → SQLite INTEGER
          post.post_date ?? null
        );
      }
    }
    
    return storyId;
  });
  
  return saveStory(story);
}

/**
 * Check if stories exist in the database
 */
export function hasStories(): boolean {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM stories').get() as { count: number };
  return row.count > 0;
}
