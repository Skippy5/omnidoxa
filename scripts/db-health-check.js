#!/usr/bin/env node
/**
 * OmniDoxa Database Health Check
 * Verifies data integrity and completeness
 */

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'omnidoxa.db'));

console.log('═══════════════════════════════════════════════════════════');
console.log('  OmniDoxa Database Health Check');
console.log('═══════════════════════════════════════════════════════════\n');

// Table counts
const stories = db.prepare('SELECT COUNT(*) as count FROM stories').get();
const viewpoints = db.prepare('SELECT COUNT(*) as count FROM viewpoints').get();
const socialPosts = db.prepare('SELECT COUNT(*) as count FROM social_posts').get();

console.log('📊 Table Counts:');
console.log(`   Stories:      ${stories.count}`);
console.log(`   Viewpoints:   ${viewpoints.count}`);
console.log(`   Social Posts: ${socialPosts.count}`);
console.log('');

// Category distribution
console.log('📂 Stories by Category:');
const categories = db.prepare(`
  SELECT category, COUNT(*) as count 
  FROM stories 
  GROUP BY category 
  ORDER BY count DESC
`).all();
categories.forEach(c => console.log(`   ${c.category}: ${c.count}`));
console.log('');

// Recent fetches
console.log('📅 Recent Fetches:');
const recentDates = db.prepare(`
  SELECT DATE(fetched_at) as date, COUNT(*) as count 
  FROM stories 
  GROUP BY DATE(fetched_at) 
  ORDER BY date DESC 
  LIMIT 5
`).all();
recentDates.forEach(d => console.log(`   ${d.date}: ${d.count} articles`));
console.log('');

// Viewpoint quality
const emptyViewpoints = db.prepare(`
  SELECT COUNT(*) as count 
  FROM viewpoints 
  WHERE summary = '' OR summary IS NULL
`).get();
const viewpointsWithTweets = db.prepare(`
  SELECT COUNT(DISTINCT viewpoint_id) as count 
  FROM social_posts
`).get();

console.log('📊 Viewpoint Quality:');
console.log(`   Empty summaries: ${emptyViewpoints.count} / ${viewpoints.count}`);
console.log(`   With tweets:     ${viewpointsWithTweets.count} / ${viewpoints.count}`);
console.log('');

// Expected vs actual
const expected = {
  categories: 8,
  storiesPerCategory: 5,
  viewpointsPerStory: 3,
  tweetsPerViewpoint: 3
};
const expectedTotalStories = expected.categories * expected.storiesPerCategory;
const expectedTotalViewpoints = expectedTotalStories * expected.viewpointsPerStory;
const expectedTotalTweets = expectedTotalViewpoints * expected.tweetsPerViewpoint;

console.log('✅ Expected vs Actual:');
console.log(`   Stories:      ${stories.count} / ${expectedTotalStories} (${(stories.count/expectedTotalStories*100).toFixed(0)}%)`);
console.log(`   Viewpoints:   ${viewpoints.count} / ${expectedTotalViewpoints} (${(viewpoints.count/expectedTotalViewpoints*100).toFixed(0)}%)`);
console.log(`   Tweets:       ${socialPosts.count} / ${expectedTotalTweets} (${(socialPosts.count/expectedTotalTweets*100).toFixed(0)}%)`);
console.log('');

// Issues summary
console.log('⚠️  Issues:');
const issues = [];
if (categories.length < 8) issues.push(`Only ${categories.length}/8 categories have data`);
if (emptyViewpoints.count > viewpoints.count * 0.1) issues.push(`${emptyViewpoints.count} viewpoints have empty summaries`);
if (socialPosts.count < expectedTotalTweets * 0.5) issues.push(`Only ${socialPosts.count} tweets (expected ${expectedTotalTweets})`);

if (issues.length === 0) {
  console.log('   ✅ No issues detected!');
} else {
  issues.forEach(i => console.log(`   ❌ ${i}`));
}

console.log('\n═══════════════════════════════════════════════════════════');
db.close();
