import "server-only";

import { createClient, type Client } from "@libsql/client";

let db: Client | null = null;

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getDb() {
  if (!db) {
    db = createClient({
      url: requiredEnv("TURSO_DATABASE_URL"),
      authToken: requiredEnv("TURSO_AUTH_TOKEN"),
    });
  }

  return db;
}

export async function applyDatabaseSchema(sql: string, client = getDb()) {
  await client.execute("PRAGMA foreign_keys = ON");
  await client.executeMultiple(sql);
}

export async function verifyDatabaseConnection(client = getDb()) {
  const result = await client.execute("SELECT 1 AS ok");
  const firstRow = result.rows[0];

  return Number(firstRow?.ok) === 1;
}
