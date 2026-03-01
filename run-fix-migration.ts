import { turso } from './src/lib/db-turso';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  console.log('🔧 Running run_type CHECK constraint fix...\n');
  
  const sql = readFileSync(join(__dirname, 'scripts/fix-run-type-constraint.sql'), 'utf-8');
  
  // Execute as batch transaction
  console.log('Executing migration statements in transaction...\n');
  
  try {
    // Step 0: Clean up any previous failed run
    await turso.execute('DROP TABLE IF EXISTS pipeline_runs_new');
    console.log('✅ Cleaned up previous migration attempt\n');
    
    // Step 1: Create new table
    await turso.execute(`
      CREATE TABLE pipeline_runs_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_type TEXT NOT NULL CHECK(run_type IN ('full_refresh', 'refresh_categories', 'keyword_search', 'reanalyze_category')),
        trigger_source TEXT NOT NULL CHECK(trigger_source IN ('cron', 'manual', 'conversational')),
        trigger_context TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'analyzing', 'promoting', 'complete', 'failed', 'cancelled')),
        current_stage TEXT,
        error_message TEXT,
        config TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`);
    console.log('✅ Created new table\n');
    
    // Step 2: Copy data (with run_type conversion)
    await turso.execute(`
      INSERT INTO pipeline_runs_new 
        (id, run_type, trigger_source, trigger_context, started_at, completed_at, 
         status, current_stage, error_message, config, created_at, updated_at)
      SELECT 
        id,
        CASE 
          WHEN run_type = 'category_refresh' THEN 'refresh_categories'
          ELSE run_type
        END as run_type,
        trigger_source,
        trigger_context,
        started_at,
        completed_at,
        status,
        current_stage,
        error_message,
        config,
        started_at as created_at,  -- Use started_at for created_at
        datetime('now') as updated_at  -- Current timestamp for updated_at
      FROM pipeline_runs
    `);
    console.log('✅ Copied data\n');
    
    // Step 3: Drop old table
    await turso.execute('DROP TABLE pipeline_runs');
    console.log('✅ Dropped old table\n');
    
    // Step 4: Rename new table
    await turso.execute('ALTER TABLE pipeline_runs_new RENAME TO pipeline_runs');
    console.log('✅ Renamed table\n');
    
    // Step 5: Recreate indexes (use IF NOT EXISTS)
    await turso.execute('CREATE INDEX IF NOT EXISTS idx_runs_type_status ON pipeline_runs(run_type, status)');
    await turso.execute('CREATE INDEX IF NOT EXISTS idx_runs_recent ON pipeline_runs(started_at DESC)');
    console.log('✅ Recreated indexes\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
  
  console.log('✅ Migration complete!');
  console.log('\nVerifying new constraint...');
  
  const result = await turso.execute(
    'SELECT sql FROM sqlite_master WHERE type="table" AND name="pipeline_runs"'
  );
  
  console.log('\nNew schema:');
  console.log(result.rows[0].sql);
}

runMigration().catch(console.error);
