import "server-only";

import { getDb } from "./db";

const TOPIC_PLACEMENT_COLUMNS = [
  {
    name: "main_feed_enabled",
    sql: "ALTER TABLE topics ADD COLUMN main_feed_enabled INTEGER DEFAULT 1",
  },
  {
    name: "category_feed_enabled",
    sql: "ALTER TABLE topics ADD COLUMN category_feed_enabled INTEGER DEFAULT 1",
  },
  {
    name: "is_featured_main",
    sql: "ALTER TABLE topics ADD COLUMN is_featured_main INTEGER DEFAULT 0",
  },
  {
    name: "featured_at",
    sql: "ALTER TABLE topics ADD COLUMN featured_at TEXT",
  },
];

let ensurePlacementColumnsPromise: Promise<void> | null = null;

async function ensureTopicPlacementColumnsOnce() {
  const db = getDb();
  const result = await db.execute("PRAGMA table_info(topics)");
  const existingColumns = new Set(
    result.rows.map((row) => String((row as Record<string, unknown>).name)),
  );

  for (const column of TOPIC_PLACEMENT_COLUMNS) {
    if (!existingColumns.has(column.name)) {
      await db.execute(column.sql);
    }
  }
}

export async function ensureTopicPlacementColumns() {
  ensurePlacementColumnsPromise ??= ensureTopicPlacementColumnsOnce().catch(
    (error) => {
      ensurePlacementColumnsPromise = null;
      throw error;
    },
  );

  return ensurePlacementColumnsPromise;
}
