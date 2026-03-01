import { turso } from './src/lib/db-turso';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  console.log('🔧 Fixing categories CHECK constraint...\n');
  
  // Check current state
  console.log('📊 Current stories by category:');
  const currentState = await turso.execute('SELECT category, COUNT(*) as count FROM stories GROUP BY category');
  console.table(currentState.rows);
  
  console.log('\n⚠️  This will:');
  console.log('  - Keep: politics, technology, business, entertainment, science, breaking, world');
  console.log('  - Drop: top, domestic, crime (if any exist)');
  console.log('  - Allow NEW: sports, health, us\n');
  
  const sql = readFileSync(join(__dirname, 'scripts/fix-categories-schema.sql'), 'utf-8');
  
  // Parse statements properly (handle triggers that contain semicolons)
  const statements: string[] = [];
  let current = '';
  let inTrigger = false;
  
  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--')) continue; // Skip comments
    
    if (trimmed.toUpperCase().startsWith('CREATE TRIGGER')) {
      inTrigger = true;
    }
    
    current += line + '\n';
    
    if (trimmed.endsWith(';')) {
      if (!inTrigger || trimmed === 'END;') {
        statements.push(current.trim());
        current = '';
        inTrigger = false;
      }
    }
  }
  
  const filteredStatements = statements.filter(s => s.length > 0);
  
  console.log(`Executing ${filteredStatements.length} SQL statements...\n`);
  
  for (let i = 0; i < filteredStatements.length; i++) {
    const stmt = filteredStatements[i];
    const preview = stmt.substring(0, 70).replace(/\n/g, ' ');
    console.log(`[${i + 1}/${filteredStatements.length}] ${preview}...`);
    
    try {
      await turso.execute(stmt);
      console.log(`  ✅ Success\n`);
    } catch (error: any) {
      console.error(`  ❌ Failed:`, error.message);
      throw error;
    }
  }
  
  console.log('✅ Migration complete!\n');
  console.log('📊 New stories table:');
  const result = await turso.execute('SELECT category, COUNT(*) as count FROM stories GROUP BY category');
  console.table(result.rows);
  
  console.log('\nVerifying schema...');
  const schema = await turso.execute('SELECT sql FROM sqlite_master WHERE name="stories"');
  console.log('\nNew CHECK constraint:');
  const checkMatch = (schema.rows[0]?.sql as string).match(/CHECK\((.*?)\)/);
  if (checkMatch) {
    console.log(checkMatch[1]);
  }
}

runMigration().catch(console.error);
