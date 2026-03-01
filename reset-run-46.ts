import { turso } from './src/lib/db-turso';

async function reset() {
  await turso.execute({
    sql: 'UPDATE pipeline_runs SET status = ?, completed_at = NULL WHERE id = 46',
    args: ['analyzing']
  });
  console.log('✅ Reset run 46 to analyzing status');
}

reset();
