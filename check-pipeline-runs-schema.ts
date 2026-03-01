import { turso } from './src/lib/db-turso';

async function checkSchema() {
  const result = await turso.execute(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='pipeline_runs'`
  );
  
  console.log('Current pipeline_runs schema:\n');
  console.log(result.rows[0].sql);
}

checkSchema();
