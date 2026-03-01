import { turso } from './src/lib/db-turso';

async function checkRun() {
  console.log('Checking run 43 articles...\n');
  
  const articles = await turso.execute(
    'SELECT id, title, status FROM staging_articles WHERE run_id = 43'
  );
  
  console.log(`Found ${articles.rows.length} articles:\n`);
  articles.rows.forEach((a: any) => {
    console.log(`  [${a.id}] ${a.status.padEnd(12)} - ${a.title.substring(0, 60)}...`);
  });
  
  const deduplicated = await turso.execute(
    'SELECT COUNT(*) as count FROM staging_articles WHERE run_id = 43 AND status = ?',
    ['deduplicated']
  );
  console.log(`\nArticles with status='deduplicated': ${deduplicated.rows[0].count}`);
  
  const selected = await turso.execute(
    'SELECT COUNT(*) as count FROM staging_articles WHERE run_id = 43 AND status = ?',
    ['selected']
  );
  console.log(`Articles with status='selected': ${selected.rows[0].count}`);
}

checkRun();
