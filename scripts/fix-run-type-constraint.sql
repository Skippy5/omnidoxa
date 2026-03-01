-- Fix run_type CHECK constraint mismatch
-- Database was using 'category_refresh', but orchestrator uses 'refresh_categories'
-- This migration aligns database with TypeScript naming

-- SQLite doesn't support ALTER COLUMN with CHECK constraints,
-- so we need to recreate the table

-- 1. Create new table with correct CHECK constraint
CREATE TABLE pipeline_runs_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_type TEXT NOT NULL CHECK(run_type IN ('full_refresh', 'refresh_categories', 'keyword_search', 'reanalyze_category')),
  trigger_source TEXT NOT NULL CHECK(trigger_source IN ('cron', 'manual', 'conversational')),
  trigger_context TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'complete', 'failed', 'cancelled')),
  current_stage TEXT,
  error_message TEXT,
  config TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Copy existing data (update old run_type values if any exist)
INSERT INTO pipeline_runs_new 
SELECT 
  id,
  CASE 
    WHEN run_type = 'category_refresh' THEN 'refresh_categories'
    ELSE run_type
  END as run_type,
  trigger_source,
  trigger_context,
  started_at,
  completed_at,
  status,
  current_stage,
  error_message,
  config,
  created_at,
  updated_at
FROM pipeline_runs;

-- 3. Drop old table
DROP TABLE pipeline_runs;

-- 4. Rename new table
ALTER TABLE pipeline_runs_new RENAME TO pipeline_runs;

-- 5. Recreate indexes
CREATE INDEX idx_runs_type_status ON pipeline_runs(run_type, status);
CREATE INDEX idx_runs_recent ON pipeline_runs(started_at DESC);
