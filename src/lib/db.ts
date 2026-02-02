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
    const socialPosts = db.prepare('SELECT * FROM social_posts WHERE viewpoint_id = ? ORDER BY likes DESC').all(vp.id) as SocialPost[];
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
