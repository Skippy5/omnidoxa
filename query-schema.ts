import { turso } from './src/lib/db-turso';

const tables = ['stories', 'viewpoints', 'social_posts', 'staging_articles', 'staging_viewpoints', 'staging_social_posts', 'pipeline_runs', 'category_status', 'analysis_jobs'];

async function main() {
  for (const table of tables) {
    const result = await turso.execute(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`);
    if (result.rows.length > 0) {
      console.log(`\n========== ${table.toUpperCase()} ==========`);
      console.log(result.rows[0].sql);
    }
  }
}

main().catch(console.error);
