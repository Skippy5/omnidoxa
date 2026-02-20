import { createClient } from '@libsql/client';
import Database from 'better-sqlite3';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

interface Story {
  id: number;
  title: string;
  description: string | null;
  url: string;
  source: string;
  image_url: string | null;
  category: string;
  published_at: string;
  fetched_at: string;
  created_at: string;
}

interface Viewpoint {
  id: number;
  story_id: number;
  lean: string;
  summary: string;
  sentiment_score: number;
  created_at: string;
}

interface SocialPost {
  id: number;
  viewpoint_id: number;
  author: string;
  author_handle: string;
  text: string;
  url: string;
  platform: string;
  likes: number;
  retweets: number;
  is_real: number;
  post_date: string | null;
  created_at: string;
}

async function migrateSQLiteToTurso() {
  if (!process.env.TURSO_DATABASE_URL) {
    throw new Error('TURSO_DATABASE_URL is not set in .env.local');
  }

  if (!process.env.TURSO_AUTH_TOKEN) {
    throw new Error('TURSO_AUTH_TOKEN is not set in .env.local');
  }

  const sqlitePath = path.join(process.cwd(), 'omnidoxa.db');
  
  console.log('📂 Opening local SQLite database...');
  const sqlite = new Database(sqlitePath, { readonly: true });

  console.log('🔗 Connecting to Turso...');
  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Read all data from SQLite
  console.log('📖 Reading stories from SQLite...');
  const stories = sqlite.prepare('SELECT * FROM stories ORDER BY id').all() as Story[];
  console.log(`   Found ${stories.length} stories`);

  console.log('📖 Reading viewpoints from SQLite...');
  const viewpoints = sqlite.prepare('SELECT * FROM viewpoints ORDER BY id').all() as Viewpoint[];
  console.log(`   Found ${viewpoints.length} viewpoints`);

  console.log('📖 Reading social posts from SQLite...');
  const socialPosts = sqlite.prepare('SELECT * FROM social_posts ORDER BY id').all() as SocialPost[];
  console.log(`   Found ${socialPosts.length} social posts`);

  sqlite.close();

  // Map old IDs to new IDs (in case of conflicts)
  const storyIdMap = new Map<number, number>();
  const viewpointIdMap = new Map<number, number>();

  // Insert stories
  console.log('\n📝 Migrating stories to Turso...');
  for (const story of stories) {
    const result = await turso.execute({
      sql: `INSERT INTO stories (title, description, url, source, image_url, category, published_at, fetched_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        story.title,
        story.description,
        story.url,
        story.source,
        story.image_url,
        story.category,
        story.published_at,
        story.fetched_at,
        story.created_at
      ]
    });
    
    storyIdMap.set(story.id, Number(result.lastInsertRowid));
  }
  console.log(`   ✅ Migrated ${stories.length} stories`);

  // Insert viewpoints
  console.log('📝 Migrating viewpoints to Turso...');
  for (const vp of viewpoints) {
    const newStoryId = storyIdMap.get(vp.story_id);
    if (!newStoryId) {
      console.warn(`   ⚠️  Skipping viewpoint ${vp.id} (story ${vp.story_id} not found)`);
      continue;
    }

    const result = await turso.execute({
      sql: `INSERT INTO viewpoints (story_id, lean, summary, sentiment_score, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [newStoryId, vp.lean, vp.summary, vp.sentiment_score, vp.created_at]
    });

    viewpointIdMap.set(vp.id, Number(result.lastInsertRowid));
  }
  console.log(`   ✅ Migrated ${viewpoints.length} viewpoints`);

  // Insert social posts
  console.log('📝 Migrating social posts to Turso...');
  for (const post of socialPosts) {
    const newViewpointId = viewpointIdMap.get(post.viewpoint_id);
    if (!newViewpointId) {
      console.warn(`   ⚠️  Skipping social post ${post.id} (viewpoint ${post.viewpoint_id} not found)`);
      continue;
    }

    await turso.execute({
      sql: `INSERT INTO social_posts (viewpoint_id, author, author_handle, text, url, platform, likes, retweets, is_real, post_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        newViewpointId,
        post.author,
        post.author_handle,
        post.text,
        post.url,
        post.platform,
        post.likes,
        post.retweets,
        post.is_real,
        post.post_date,
        post.created_at
      ]
    });
  }
  console.log(`   ✅ Migrated ${socialPosts.length} social posts`);

  // Verify migration
  console.log('\n🔍 Verifying migration...');
  const storyCount = await turso.execute('SELECT COUNT(*) as count FROM stories');
  const vpCount = await turso.execute('SELECT COUNT(*) as count FROM viewpoints');
  const postCount = await turso.execute('SELECT COUNT(*) as count FROM social_posts');

  console.log(`   Stories: ${(storyCount.rows[0] as any).count}`);
  console.log(`   Viewpoints: ${(vpCount.rows[0] as any).count}`);
  console.log(`   Social Posts: ${(postCount.rows[0] as any).count}`);

  console.log('\n✅ Migration complete!');
  console.log('\nNext steps:');
  console.log('  1. Update API routes to use db-cloud.ts');
  console.log('  2. Set Vercel environment variables');
  console.log('  3. Deploy to Vercel');
}

migrateSQLiteToTurso()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
