import { turso } from './src/lib/db-turso';

async function checkSchema() {
  const r = await turso.execute('PRAGMA table_info(social_posts)');
  console.log('social_posts columns:');
  r.rows.forEach((row: any) => {
    console.log(`  - ${row.name} (${row.type})`);
  });
}

checkSchema();
