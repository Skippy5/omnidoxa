/**
 * Fix CHECK constraint on staging_articles.status
 * Add 'deduplicated' as valid status value
 */

import { turso } from '../src/lib/db-turso';
import * as fs from 'fs';
import * as path from 'path';

async function fixConstraint() {
  console.log('🔧 Fixing staging_articles CHECK constraint...\n');
  
  try {
    // Read the migration SQL
    const sqlPath = path.join(__dirname, '..', 'src', 'lib', 'db', 'schema-staging-fix.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    // Split into individual statements (skip comments and empty lines)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📋 Found ${statements.length} SQL statements\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`[${i + 1}/${statements.length}] Executing: ${stmt.substring(0, 60)}...`);
      
      try {
        await turso.execute(stmt);
        console.log(`✅ Success\n`);
      } catch (error: any) {
        console.error(`❌ Failed: ${error.message}\n`);
        throw error;
      }
    }
    
    console.log('✅ Migration complete!\n');
    
    // Verify the new constraint
    console.log('🔍 Verifying new constraint...');
    const result = await turso.execute('PRAGMA table_info(staging_articles)');
    const statusColumn = result.rows.find((r: any) => r.name === 'status');
    console.log('Status column:', statusColumn);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

fixConstraint();
