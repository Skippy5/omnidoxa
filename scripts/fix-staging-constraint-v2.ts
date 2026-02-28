/**
 * Fix CHECK constraint on staging_articles.status
 * Add 'deduplicated' as valid status value
 */

import { turso } from '../src/lib/db-turso';

async function fixConstraint() {
  console.log('🔧 Fixing staging_articles CHECK constraint...\n');
  
  try {
    // Step 1: Create new table with updated constraint
    console.log('[1/6] Creating new table with updated constraint...');
    await turso.execute(`
      CREATE TABLE staging_articles_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        title_normalized TEXT NOT NULL,
        description TEXT,
        url TEXT NOT NULL,
        url_normalized TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        source TEXT,
        image_url TEXT,
        published_at TEXT,
        fetched_at TEXT DEFAULT (datetime('now')),
        pull_batch INTEGER DEFAULT 1,
        status TEXT DEFAULT 'staged' CHECK(status IN ('staged', 'deduplicated', 'selected', 'rejected')),
        rejection_reason TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    console.log('✅ New table created\n');
    
    // Step 2: Copy data
    console.log('[2/6] Copying data from old table...');
    await turso.execute('INSERT INTO staging_articles_new SELECT * FROM staging_articles');
    console.log('✅ Data copied\n');
    
    // Step 3: Drop indexes (they reference the old table)
    console.log('[3/6] Dropping old indexes...');
    const indexes = [
      'idx_staging_articles_run',
      'idx_staging_articles_url',
      'idx_staging_articles_hash',
      'idx_staging_articles_title'
    ];
    
    for (const idx of indexes) {
      try {
        await turso.execute(`DROP INDEX IF EXISTS ${idx}`);
        console.log(`  ✅ Dropped ${idx}`);
      } catch (e: any) {
        console.log(`  ⚠️  Could not drop ${idx}: ${e.message}`);
      }
    }
    console.log();
    
    // Step 4: Drop old table
    console.log('[4/6] Dropping old table...');
    await turso.execute('DROP TABLE staging_articles');
    console.log('✅ Old table dropped\n');
    
    // Step 5: Rename new table
    console.log('[5/6] Renaming new table...');
    await turso.execute('ALTER TABLE staging_articles_new RENAME TO staging_articles');
    console.log('✅ Table renamed\n');
    
    // Step 6: Recreate indexes
    console.log('[6/6] Recreating indexes...');
    await turso.execute('CREATE INDEX idx_staging_articles_run ON staging_articles(run_id, category, status)');
    console.log('  ✅ idx_staging_articles_run');
    
    await turso.execute('CREATE INDEX idx_staging_articles_url ON staging_articles(url_normalized)');
    console.log('  ✅ idx_staging_articles_url');
    
    await turso.execute('CREATE INDEX idx_staging_articles_hash ON staging_articles(content_hash)');
    console.log('  ✅ idx_staging_articles_hash');
    
    await turso.execute('CREATE INDEX idx_staging_articles_title ON staging_articles(title_normalized)');
    console.log('  ✅ idx_staging_articles_title');
    
    console.log('\n✅ Migration complete!\n');
    
    // Verify (just check table structure)
    console.log('🔍 Verifying constraint...');
    const info = await turso.execute('PRAGMA table_info(staging_articles)');
    const statusCol = info.rows.find((r: any) => r.name === 'status');
    console.log('✅ Status column exists:', statusCol ? 'YES' : 'NO');
    
    console.log('🎉 Migration successful!');
    process.exit(0);
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

fixConstraint();
