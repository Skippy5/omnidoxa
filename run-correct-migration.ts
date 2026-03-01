import { turso } from './src/lib/db-turso';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  console.log('🔧 Reverting to CORRECT categories...\n');
  
  console.log('📊 Current stories:');
  const current = await turso.execute('SELECT category, COUNT(*) as count FROM stories GROUP BY category');
  console.table(current.rows);
  
  console.log('\n✅ Correct categories: top, breaking, technology, domestic, business, crime, entertainment, politics, science, world\n');
  
  const sql = readFileSync(join(__dirname, 'scripts/fix-categories-correct.sql'), 'utf-8');
  
  const statements: string[] = [];
  let current_stmt = '';
  let inTrigger = false;
  
  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--')) continue;
    
    if (trimmed.toUpperCase().startsWith('CREATE TRIGGER')) {
      inTrigger = true;
    }
    
    current_stmt += line + '\n';
    
    if (trimmed.endsWith(';')) {
      if (!inTrigger || trimmed === 'END;') {
        statements.push(current_stmt.trim());
        current_stmt = '';
        inTrigger = false;
      }
    }
  }
  
  const filtered = statements.filter(s => s.length > 0);
  console.log(`Executing ${filtered.length} statements...\n`);
  
  for (let i = 0; i < filtered.length; i++) {
    const stmt = filtered[i];
    const preview = stmt.substring(0, 70).replace(/\n/g, ' ');
    console.log(`[${i + 1}/${filtered.length}] ${preview}...`);
    
    try {
      await turso.execute(stmt);
      console.log(`  ✅ Success\n`);
    } catch (error: any) {
      console.error(`  ❌ Failed:`, error.message);
      throw error;
    }
  }
  
  console.log('✅ Migration complete!\n');
  const result = await turso.execute('SELECT category, COUNT(*) as count FROM stories GROUP BY category');
  console.table(result.rows);
}

runMigration().catch(console.error);
