import { turso } from './src/lib/db-turso';

async function checkRun() {
  console.log('Checking pipeline run #40...\n');
  
  const run = await turso.execute('SELECT * FROM pipeline_runs WHERE id = 40');
  console.log('Run 40:', run.rows[0] || 'Not found');
  
  const category = await turso.execute('SELECT * FROM category_status WHERE run_id = 40');
  console.log('\nCategory status:', category.rows);
  
  const articles = await turso.execute('SELECT COUNT(*) as count FROM staging_articles WHERE run_id = 40');
  console.log('\nArticles staged:', articles.rows[0]);
}

checkRun();
