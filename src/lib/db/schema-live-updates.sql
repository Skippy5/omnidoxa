-- =============================================================================
-- OmniDoxa Pipeline - Live Table Updates
-- =============================================================================
-- Purpose: Add timestamp tracking to existing live tables
-- Created: 2026-02-28
-- Phase: 1.2 - Live Table Updates
--
-- Updates:
-- - Add `updated_at` column to stories, viewpoints, social_posts
-- - Create triggers to auto-update timestamps on UPDATE
--
-- Design Notes:
-- - Supports re-analysis operations (tracks when data was last modified)
-- - Triggers fire automatically on any UPDATE (no manual timestamp management)
-- - Uses SQLite datetime('now') for consistency
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Add updated_at Columns
-- -----------------------------------------------------------------------------
-- SQLite limitation: ALTER TABLE doesn't support function defaults
-- Workaround: Add column with NULL, then UPDATE existing rows, then rely on triggers

ALTER TABLE stories ADD COLUMN updated_at TEXT;

ALTER TABLE viewpoints ADD COLUMN updated_at TEXT;

ALTER TABLE social_posts ADD COLUMN updated_at TEXT;

-- Set initial timestamps for existing rows
UPDATE stories SET updated_at = datetime('now') WHERE updated_at IS NULL;

UPDATE viewpoints SET updated_at = datetime('now') WHERE updated_at IS NULL;

UPDATE social_posts SET updated_at = datetime('now') WHERE updated_at IS NULL;

-- -----------------------------------------------------------------------------
-- Auto-Update Triggers
-- -----------------------------------------------------------------------------
-- Automatically update `updated_at` timestamp whenever a row is modified
-- Ensures accurate tracking for re-analysis operations

-- Stories timestamp trigger
CREATE TRIGGER update_stories_timestamp 
  AFTER UPDATE ON stories
  BEGIN
    UPDATE stories SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

-- Viewpoints timestamp trigger
CREATE TRIGGER update_viewpoints_timestamp 
  AFTER UPDATE ON viewpoints
  BEGIN
    UPDATE viewpoints SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

-- Social posts timestamp trigger
CREATE TRIGGER update_posts_timestamp 
  AFTER UPDATE ON social_posts
  BEGIN
    UPDATE social_posts SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

-- =============================================================================
-- END OF LIVE TABLE UPDATES
-- =============================================================================
