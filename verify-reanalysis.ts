import { turso } from './src/lib/db-turso';

async function verify() {
  console.log('🔍 Verifying re-analysis results for article #714\n');
  
  // Check viewpoints
  const viewpoints = await turso.execute({
    sql: 'SELECT * FROM viewpoints WHERE story_id = 714',
    args: []
  });
  
  console.log(`✅ Found ${viewpoints.rows.length} viewpoints:`);
  for (const vp of viewpoints.rows) {
    console.log(`  - ${vp.lean}: "${(vp.summary as string).substring(0, 60)}..." (sentiment: ${vp.sentiment_score})`);
  }
  
  // Check social posts
  const posts = await turso.execute({
    sql: `SELECT sp.* FROM social_posts sp 
          JOIN viewpoints v ON sp.viewpoint_id = v.id 
          WHERE v.story_id = 714`,
    args: []
  });
  
  console.log(`\n✅ Found ${posts.rows.length} social posts:`);
  for (const post of posts.rows) {
    console.log(`  - @${post.author}: "${(post.text as string).substring(0, 50)}..."`);
  }
  
  console.log('\n🎉 Re-analysis data verified in live database!');
}

verify();
