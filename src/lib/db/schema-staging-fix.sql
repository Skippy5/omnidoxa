-- Fix CHECK constraint on staging_articles.status
-- Add 'deduplicated' as valid status value
-- 
-- SQLite doesn't support ALTER TABLE ... ALTER COLUMN to modify CHECK constraints
-- We need to:
-- 1. Create new table with updated constraint
-- 2. Copy data
-- 3. Drop old table
-- 4. Rename new table

-- Create new table with correct CHECK constraint
CREATE TABLE staging_articles_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  title_normalized TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  url_normalized TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  source TEXT,
  image_url TEXT,
  published_at TEXT,
  fetched_at TEXT DEFAULT (datetime('now')),
  pull_batch INTEGER DEFAULT 1,
  status TEXT DEFAULT 'staged' CHECK(status IN ('staged', 'deduplicated', 'selected', 'rejected')),
  rejection_reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Copy data from old table
INSERT INTO staging_articles_new 
SELECT * FROM staging_articles;

-- Drop old table
DROP TABLE staging_articles;

-- Rename new table
ALTER TABLE staging_articles_new RENAME TO staging_articles;

-- Recreate indexes (were lost with table drop)
CREATE INDEX idx_staging_articles_run ON staging_articles(run_id, category, status);
CREATE INDEX idx_staging_articles_url ON staging_articles(url_normalized);
CREATE INDEX idx_staging_articles_hash ON staging_articles(content_hash);
CREATE INDEX idx_staging_articles_title ON staging_articles(title_normalized);
