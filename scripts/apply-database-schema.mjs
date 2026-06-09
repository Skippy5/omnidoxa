import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";
import nextEnv from "@next/env";

const projectDir = process.cwd();
const schemaPath = path.join(projectDir, "docs", "database", "schema.sql");

const { loadEnvConfig } = nextEnv;

loadEnvConfig(projectDir, true);

function requiredEnv(name) {
  const value = process.env[name];

  if (!value || value.startsWith("your_")) {
    throw new Error(`Missing real ${name}. Add it to .env.local before applying the schema.`);
  }

  return value;
}

const db = createClient({
  url: requiredEnv("TURSO_DATABASE_URL"),
  authToken: requiredEnv("TURSO_AUTH_TOKEN"),
});

const sql = await readFile(schemaPath, "utf8");

const additiveTopicColumns = [
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

async function applyAdditiveTopicColumns() {
  const tableInfo = await db.execute("PRAGMA table_info(topics)");
  const existingColumns = new Set(tableInfo.rows.map((row) => String(row.name)));

  for (const column of additiveTopicColumns) {
    if (!existingColumns.has(column.name)) {
      await db.execute(column.sql);
      console.log(`Added topics.${column.name}`);
    }
  }
}

try {
  await db.execute("PRAGMA foreign_keys = ON");
  await db.executeMultiple(sql);
  await applyAdditiveTopicColumns();
  console.log(`Applied schema from ${path.relative(projectDir, schemaPath)}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`Failed to apply schema from ${path.relative(projectDir, schemaPath)}.`);
  console.error(message);
  process.exitCode = 1;
} finally {
  db.close();
}
