import { turso } from './src/lib/db-turso';

async function check() {
  const r = await turso.execute('SELECT sql FROM sqlite_master WHERE name="viewpoints"');
  console.log('viewpoints table schema:\n');
  console.log(r.rows[0]?.sql);
  
  console.log('\n\nIndexes and constraints:');
  const indexes = await turso.execute('SELECT sql FROM sqlite_master WHERE type="index" AND tbl_name="viewpoints"');
  indexes.rows.forEach(row => console.log(row.sql));
}

check();
