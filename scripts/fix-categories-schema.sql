-- Fix categories CHECK constraint to match new pipeline categories
-- Old: 'top', 'breaking', 'technology', 'domestic', 'business', 'crime', 'entertainment', 'politics', 'science', 'world'
-- New: 'politics', 'technology', 'business', 'sports', 'entertainment', 'health', 'science', 'breaking', 'world', 'us'

-- SQLite doesn't support ALTER TABLE to modify CHECK constraints
-- We need to recreate the table

-- 0. Clean up any previous failed migration attempt
DROP TABLE IF EXISTS stories_new;

-- 1. Create new table with correct CHECK constraint
CREATE TABLE stories_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL,
    image_url TEXT,
    category TEXT NOT NULL CHECK(category IN ('politics', 'technology', 'business', 'sports', 'entertainment', 'health', 'science', 'breaking', 'world', 'us')),
    published_at TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
);

-- 2. Copy existing data (only categories that exist in both schemas)
INSERT INTO stories_new 
SELECT * FROM stories 
WHERE category IN ('politics', 'technology', 'business', 'entertainment', 'science', 'breaking', 'world');

-- 3. Drop old table
DROP TABLE stories;

-- 4. Rename new table
ALTER TABLE stories_new RENAME TO stories;

-- 5. Recreate indexes (IF NOT EXISTS to handle retries)
CREATE INDEX IF NOT EXISTS idx_stories_category ON stories(category);
CREATE INDEX IF NOT EXISTS idx_stories_fetched_at ON stories(fetched_at);

-- 6. Recreate trigger
CREATE TRIGGER IF NOT EXISTS update_stories_timestamp 
AFTER UPDATE ON stories
FOR EACH ROW
BEGIN
  UPDATE stories SET updated_at = datetime('now') WHERE id = NEW.id;
END;
