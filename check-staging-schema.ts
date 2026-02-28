import { turso } from './src/lib/db-turso';

async function checkSchema() {
  console.log('=== staging_social_posts ===');
  const staging = await turso.execute('PRAGMA table_info(staging_social_posts)');
  staging.rows.forEach((row: any) => {
    console.log(`  - ${row.name} (${row.type})`);
  });
  
  console.log('\n=== social_posts ===');
  const live = await turso.execute('PRAGMA table_info(social_posts)');
  live.rows.forEach((row: any) => {
    console.log(`  - ${row.name} (${row.type})`);
  });
}

checkSchema();
