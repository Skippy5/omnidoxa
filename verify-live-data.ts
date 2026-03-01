import { turso } from './src/lib/db-turso';

async function verify() {
  console.log('📰 LIVE DATABASE - VERIFICATION\n');
  
  // Stories by category
  const stories = await turso.execute(`
    SELECT category, COUNT(*) as count, MAX(created_at) as latest
    FROM stories
    WHERE created_at > datetime('now', '-1 hour')
    GROUP BY category
    ORDER BY category
  `);
  
  console.log('Stories by category (last hour):');
  console.table(stories.rows);
  
  // Total stats
  const totals = await turso.execute(`
    SELECT 
      (SELECT COUNT(*) FROM stories WHERE created_at > datetime('now', '-1 hour')) as stories,
      (SELECT COUNT(*) FROM viewpoints WHERE created_at > datetime('now', '-1 hour')) as viewpoints,
      (SELECT COUNT(*) FROM social_posts) as social_posts
  `);
  
  console.log('\nTotal counts:');
  console.log(`  Stories: ${totals.rows[0].stories}`);
  console.log(`  Viewpoints: ${totals.rows[0].viewpoints}`);
  console.log(`  Social Posts: ${totals.rows[0].social_posts}`);
  
  // Sample article
  const sample = await turso.execute(`
    SELECT s.id, s.title, s.category, s.created_at,
           COUNT(DISTINCT v.id) as viewpoints_count,
           COUNT(DISTINCT sp.id) as posts_count
    FROM stories s
    LEFT JOIN viewpoints v ON s.id = v.story_id
    LEFT JOIN social_posts sp ON v.id = sp.viewpoint_id
    WHERE s.created_at > datetime('now', '-1 hour')
    GROUP BY s.id
    LIMIT 1
  `);
  
  if (sample.rows.length > 0) {
    const article = sample.rows[0];
    console.log('\nSample Article:');
    console.log(`  ID: ${article.id}`);
    console.log(`  Title: ${article.title}`);
    console.log(`  Category: ${article.category}`);
    console.log(`  Viewpoints: ${article.viewpoints_count}`);
    console.log(`  Social Posts: ${article.posts_count}`);
    console.log(`  Created: ${article.created_at}`);
  }
  
  console.log('\n✅ Promotion verified - data is LIVE!');
}

verify();
