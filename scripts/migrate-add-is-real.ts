/**
 * Migration: Add is_real and post_date columns to social_posts
 *
 * Run with:
 *   node --experimental-strip-types scripts/migrate-add-is-real.ts
 *
 * Safe to run multiple times — checks for column existence before altering.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'omnidoxa.db');

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfo[];
  return cols.some((c) => c.name === column);
}

const db = new Database(DB_PATH);

try {
  db.pragma('journal_mode = WAL');

  // ── Column 1: is_real ─────────────────────────────────────────────────────
  if (!columnExists(db, 'social_posts', 'is_real')) {
    db.exec(`ALTER TABLE social_posts ADD COLUMN is_real INTEGER NOT NULL DEFAULT 0`);
    console.log('✅  Added is_real INTEGER NOT NULL DEFAULT 0 to social_posts');
  } else {
    console.log('⏭️   is_real already exists — skipping');
  }

  // ── Column 2: post_date ───────────────────────────────────────────────────
  // Stores the original date/time of the post from the source platform.
  // Nullable because real posts may lack precise timestamps, and synthetic
  // fallback posts have no meaningful post date.
  if (!columnExists(db, 'social_posts', 'post_date')) {
    db.exec(`ALTER TABLE social_posts ADD COLUMN post_date TEXT`);
    console.log('✅  Added post_date TEXT (nullable) to social_posts');
  } else {
    console.log('⏭️   post_date already exists — skipping');
  }

  // ── Verify ────────────────────────────────────────────────────────────────
  const cols = (db.prepare('PRAGMA table_info(social_posts)').all() as ColumnInfo[]).map((c) => c.name);
  console.log('\nFinal social_posts columns:', cols.join(', '));
  console.log('\n🎉  Migration complete.');
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
} finally {
  db.close();
}
