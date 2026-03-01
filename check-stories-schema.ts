import { turso } from './src/lib/db-turso';

async function check() {
  const r = await turso.execute('SELECT sql FROM sqlite_master WHERE name="stories"');
  console.log('Stories table schema:\n');
  console.log(r.rows[0]?.sql);
  
  console.log('\n\nIndexes:');
  const indexes = await turso.execute('SELECT sql FROM sqlite_master WHERE type="index" AND tbl_name="stories"');
  indexes.rows.forEach(row => console.log(row.sql));
}

check();
