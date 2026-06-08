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

try {
  await db.execute("PRAGMA foreign_keys = ON");
  await db.executeMultiple(sql);
  console.log(`Applied schema from ${path.relative(projectDir, schemaPath)}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`Failed to apply schema from ${path.relative(projectDir, schemaPath)}.`);
  console.error(message);
  process.exitCode = 1;
} finally {
  db.close();
}
