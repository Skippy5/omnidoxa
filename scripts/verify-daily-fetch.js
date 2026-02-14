#!/usr/bin/env node
/**
 * Verify daily fetch completed successfully
 * Run after cron job to check results
 */

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'omnidoxa.db'));

const today = new Date().toISOString().split('T')[0];

const todayStories = db.prepare(`
  SELECT COUNT(*) as count 
  FROM stories 
  WHERE DATE(fetched_at) = ?
`).get(today);

console.log(`📅 Stories fetched today (${today}): ${todayStories.count}`);

if (todayStories.count < 35) {
  console.error('❌ WARNING: Less than 35 stories fetched today!');
  process.exit(1);
} else {
  console.log('✅ Daily fetch looks healthy');
  process.exit(0);
}

db.close();
