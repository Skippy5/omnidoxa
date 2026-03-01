import { turso } from './src/lib/db-turso';

async function checkStatus() {
  console.log('🔍 Checking Run 46 Status\n');
  
  // Check run status
  const run = await turso.execute('SELECT * FROM pipeline_runs WHERE id = 46');
  console.log('Run Status:', {
    id: run.rows[0]?.id,
    status: run.rows[0]?.status,
    current_stage: run.rows[0]?.current_stage,
    started_at: run.rows[0]?.started_at,
    error_message: run.rows[0]?.error_message
  });
  
  // Check staging articles
  const staging = await turso.execute(`
    SELECT status, COUNT(*) as count 
    FROM staging_articles 
    WHERE run_id = 46 
    GROUP BY status
  `);
  console.log('\n📊 Staging Articles:', staging.rows);
  
  // Check staging viewpoints
  const viewpoints = await turso.execute(`
    SELECT COUNT(*) as count FROM staging_viewpoints WHERE run_id = 46
  `);
  console.log('\n👁️ Staging Viewpoints:', viewpoints.rows[0]?.count);
  
  // Check staging social posts
  const posts = await turso.execute(`
    SELECT COUNT(*) as count FROM staging_social_posts WHERE run_id = 46
  `);
  console.log('💬 Staging Social Posts:', posts.rows[0]?.count);
  
  // Check if any promoted to live
  const liveStories = await turso.execute(`
    SELECT COUNT(*) as count 
    FROM stories 
    WHERE created_at > datetime('now', '-1 hour')
  `);
  console.log('\n📰 Live Stories (last hour):', liveStories.rows[0]?.count);
  
  const liveViewpoints = await turso.execute(`
    SELECT COUNT(*) as count 
    FROM viewpoints 
    WHERE created_at > datetime('now', '-1 hour')
  `);
  console.log('👁️ Live Viewpoints (last hour):', liveViewpoints.rows[0]?.count);
  
  const livePosts = await turso.execute(`
    SELECT COUNT(*) as count 
    FROM social_posts 
    WHERE created_at > datetime('now', '-1 hour')
  `);
  console.log('💬 Live Social Posts (last hour):', livePosts.rows[0]?.count);
}

checkStatus();
