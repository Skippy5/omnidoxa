import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL,
    image_url TEXT,
    category TEXT NOT NULL CHECK(category IN ('top', 'breaking', 'technology', 'domestic', 'business', 'crime', 'entertainment', 'politics', 'science', 'world')),
    published_at TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS viewpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id INTEGER NOT NULL,
    lean TEXT NOT NULL CHECK(lean IN ('left', 'center', 'right')),
    summary TEXT NOT NULL,
    sentiment_score REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS social_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    viewpoint_id INTEGER NOT NULL,
    author TEXT NOT NULL,
    author_handle TEXT NOT NULL,
    text TEXT NOT NULL,
    url TEXT NOT NULL,
    platform TEXT NOT NULL,
    likes INTEGER NOT NULL DEFAULT 0,
    retweets INTEGER NOT NULL DEFAULT 0,
    is_real INTEGER NOT NULL DEFAULT 0,
    post_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (viewpoint_id) REFERENCES viewpoints(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_stories_category ON stories(category);
  CREATE INDEX IF NOT EXISTS idx_stories_fetched_at ON stories(fetched_at);
  CREATE INDEX IF NOT EXISTS idx_viewpoints_story_id ON viewpoints(story_id);
  CREATE INDEX IF NOT EXISTS idx_social_posts_viewpoint_id ON social_posts(viewpoint_id);
`;

async function initializeTurso() {
  if (!process.env.TURSO_DATABASE_URL) {
    throw new Error('TURSO_DATABASE_URL is not set in .env.local');
  }

  if (!process.env.TURSO_AUTH_TOKEN) {
    throw new Error('TURSO_AUTH_TOKEN is not set in .env.local');
  }

  console.log('🔗 Connecting to Turso database...');
  console.log(`   URL: ${process.env.TURSO_DATABASE_URL}`);

  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  console.log('📋 Creating schema...');
  
  // Split schema into individual statements (Turso doesn't support multi-statement execute)
  const statements = SCHEMA_SQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    await db.execute(statement);
  }

  console.log('✅ Turso schema initialized successfully!');
  console.log('\nNext steps:');
  console.log('  1. Run: npx ts-node scripts/migrate-to-turso.ts');
  console.log('  2. Update API routes to use db-cloud.ts');
  console.log('  3. Deploy to Vercel with env vars set');
}

initializeTurso()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error initializing Turso:', err);
    process.exit(1);
  });
