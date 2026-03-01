-- Revert to CORRECT category list (old system was right!)
-- Categories: top, breaking, technology, domestic, business, crime, entertainment, politics, science, world

-- 0. Clean up
DROP TABLE IF EXISTS stories_new;

-- 1. Create new table with CORRECT CHECK constraint
CREATE TABLE stories_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL,
    image_url TEXT,
    category TEXT NOT NULL CHECK(category IN ('top', 'breaking', 'technology', 'domestic', 'business', 'crime', 'entertainment', 'politics', 'science', 'world')),
    published_at TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
);

-- 2. Copy all existing data (keep categories that are in both schemas)
INSERT INTO stories_new 
SELECT * FROM stories 
WHERE category IN ('breaking', 'technology', 'business', 'entertainment', 'politics', 'science', 'world');

-- 3. Drop old table
DROP TABLE stories;

-- 4. Rename new table
ALTER TABLE stories_new RENAME TO stories;

-- 5. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_stories_category ON stories(category);
CREATE INDEX IF NOT EXISTS idx_stories_fetched_at ON stories(fetched_at);

-- 6. Recreate trigger
CREATE TRIGGER IF NOT EXISTS update_stories_timestamp 
AFTER UPDATE ON stories
FOR EACH ROW
BEGIN
  UPDATE stories SET updated_at = datetime('now') WHERE id = NEW.id;
END;
