import Database from 'better-sqlite3';

export function initializeDatabase(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      url TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL,
      image_url TEXT,
      category TEXT NOT NULL CHECK(category IN ('breaking', 'business', 'crime', 'entertainment', 'politics', 'science', 'top', 'world')),
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (viewpoint_id) REFERENCES viewpoints(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_stories_category ON stories(category);
    CREATE INDEX IF NOT EXISTS idx_stories_fetched_at ON stories(fetched_at);
    CREATE INDEX IF NOT EXISTS idx_viewpoints_story_id ON viewpoints(story_id);
    CREATE INDEX IF NOT EXISTS idx_social_posts_viewpoint_id ON social_posts(viewpoint_id);
  `);
}
