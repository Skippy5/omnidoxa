/**
 * Run Schema Migrations
 * 
 * Executes both staging and live table migrations in Turso.
 * Phase: 1.1-1.2 Database Schema
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

/**
 * Parse SQL file into individual statements
 * Handles multi-line statements, comments, and trigger blocks (BEGIN...END)
 */
function parseSQLStatements(sql: string): string[] {
  const statements: string[] = [];
  let currentStatement = '';
  let inTriggerBlock = false;

  const lines = sql.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Skip comment lines
    if (trimmed.startsWith('--')) {
      // Check if it's a separator line (just dashes)
      if (trimmed.replace(/-/g, '').length === 0) {
        continue;
      }
      // Skip other comments
      continue;
    }

    // Add line to current statement
    currentStatement += line + '\n';

    // Detect trigger blocks (BEGIN...END)
    if (trimmed.toUpperCase().includes('BEGIN')) {
      inTriggerBlock = true;
    }

    if (trimmed.toUpperCase().includes('END;')) {
      inTriggerBlock = false;
      // Trigger is complete
      const stmt = currentStatement.trim();
      if (stmt.length > 1) {
        statements.push(stmt);
      }
      currentStatement = '';
      continue;
    }

    // Check if statement is complete (ends with semicolon, not in trigger block)
    if (trimmed.endsWith(';') && !inTriggerBlock) {
      const stmt = currentStatement.trim();
      if (stmt.length > 1) {  // More than just the semicolon
        statements.push(stmt);
      }
      currentStatement = '';
    }
  }

  return statements;
}

async function runMigrations() {
  console.log('🚀 OmniDoxa Schema Migration Runner\n');
  console.log('=' .repeat(70));
  
  // Check environment variables
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error('❌ Missing Turso credentials in .env.local');
    process.exit(1);
  }

  // Connect to Turso
  console.log('\n🔗 Connecting to Turso...');
  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  console.log('✅ Connected!\n');

  // ============================================================================
  // MIGRATION 1: Staging Schema
  // ============================================================================
  console.log('=' .repeat(70));
  console.log('MIGRATION 1: Staging Tables & Indexes');
  console.log('=' .repeat(70) + '\n');

  const stagingSQL = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/db/schema-staging.sql'),
    'utf-8'
  );

  const stagingStatements = parseSQLStatements(stagingSQL);
  console.log(`📊 Parsed ${stagingStatements.length} statements from schema-staging.sql\n`);

  let stagingSuccess = 0;
  let stagingSkipped = 0;
  let stagingFailed = 0;

  for (let i = 0; i < stagingStatements.length; i++) {
    const stmt = stagingStatements[i];
    
    // Extract statement type and name
    let stmtType = 'UNKNOWN';
    let stmtName = '';
    
    if (stmt.includes('CREATE TABLE')) {
      stmtType = 'TABLE';
      const match = stmt.match(/CREATE TABLE (\w+)/i);
      stmtName = match ? match[1] : '';
    } else if (stmt.includes('CREATE INDEX')) {
      stmtType = 'INDEX';
      const match = stmt.match(/CREATE INDEX (\w+)/i);
      stmtName = match ? match[1] : '';
    }

    try {
      await turso.execute(stmt);
      console.log(`✅ [${i + 1}/${stagingStatements.length}] ${stmtType}: ${stmtName}`);
      stagingSuccess++;
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        console.log(`⏭️  [${i + 1}/${stagingStatements.length}] ${stmtType}: ${stmtName} (already exists)`);
        stagingSkipped++;
      } else {
        console.error(`❌ [${i + 1}/${stagingStatements.length}] ${stmtType}: ${stmtName}`);
        console.error(`   Error: ${err.message}`);
        stagingFailed++;
      }
    }
  }

  console.log('\n📊 Staging Migration Summary:');
  console.log(`   ✅ Created: ${stagingSuccess}`);
  console.log(`   ⏭️  Skipped: ${stagingSkipped}`);
  console.log(`   ❌ Failed: ${stagingFailed}\n`);

  // ============================================================================
  // MIGRATION 2: Live Table Updates
  // ============================================================================
  console.log('=' .repeat(70));
  console.log('MIGRATION 2: Live Table Updates (updated_at + Triggers)');
  console.log('=' .repeat(70) + '\n');

  const liveSQL = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/db/schema-live-updates.sql'),
    'utf-8'
  );

  const liveStatements = parseSQLStatements(liveSQL);
  console.log(`📊 Parsed ${liveStatements.length} statements from schema-live-updates.sql\n`);

  let liveSuccess = 0;
  let liveSkipped = 0;
  let liveFailed = 0;

  for (let i = 0; i < liveStatements.length; i++) {
    const stmt = liveStatements[i];
    
    // Extract statement type
    let stmtType = 'UNKNOWN';
    let stmtName = '';
    
    if (stmt.includes('ALTER TABLE')) {
      stmtType = 'ALTER';
      const match = stmt.match(/ALTER TABLE (\w+)/i);
      stmtName = match ? match[1] : '';
    } else if (stmt.includes('UPDATE')) {
      stmtType = 'UPDATE';
      const match = stmt.match(/UPDATE (\w+)/i);
      stmtName = match ? match[1] : '';
    } else if (stmt.includes('CREATE TRIGGER')) {
      stmtType = 'TRIGGER';
      const match = stmt.match(/CREATE TRIGGER (\w+)/i);
      stmtName = match ? match[1] : '';
    }

    try {
      await turso.execute(stmt);
      console.log(`✅ [${i + 1}/${liveStatements.length}] ${stmtType}: ${stmtName}`);
      liveSuccess++;
    } catch (err: any) {
      if (err.message?.includes('duplicate') || err.message?.includes('already exists')) {
        console.log(`⏭️  [${i + 1}/${liveStatements.length}] ${stmtType}: ${stmtName} (already exists)`);
        liveSkipped++;
      } else if (stmt.includes('UPDATE') && err.message?.includes('no such column')) {
        // Column doesn't exist yet - this is expected on first run
        console.log(`⏭️  [${i + 1}/${liveStatements.length}] ${stmtType}: ${stmtName} (column not added yet)`);
        liveSkipped++;
      } else {
        console.error(`❌ [${i + 1}/${liveStatements.length}] ${stmtType}: ${stmtName}`);
        console.error(`   Error: ${err.message}`);
        liveFailed++;
      }
    }
  }

  console.log('\n📊 Live Migration Summary:');
  console.log(`   ✅ Created: ${liveSuccess}`);
  console.log(`   ⏭️  Skipped: ${liveSkipped}`);
  console.log(`   ❌ Failed: ${liveFailed}\n`);

  // ============================================================================
  // VERIFICATION
  // ============================================================================
  console.log('=' .repeat(70));
  console.log('VERIFICATION');
  console.log('=' .repeat(70) + '\n');

  // Check staging tables
  console.log('📋 Staging Tables:');
  const stagingTables = [
    'pipeline_runs',
    'category_status',
    'staging_articles',
    'analysis_jobs',
    'staging_viewpoints',
    'staging_social_posts',
    'pipeline_lock'
  ];

  for (const table of stagingTables) {
    const result = await turso.execute({
      sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      args: [table]
    });
    const exists = result.rows.length > 0;
    console.log(`   ${exists ? '✅' : '❌'} ${table}`);
  }

  // Check indexes
  console.log('\n📑 Indexes:');
  const indexes = [
    'idx_runs_type_status',
    'idx_runs_recent',
    'idx_category_status_run',
    'idx_staging_articles_run',
    'idx_staging_articles_url',
    'idx_staging_articles_hash',
    'idx_staging_articles_title',
    'idx_analysis_jobs_lookup',
    'idx_staging_viewpoints_lookup',
    'idx_staging_posts_viewpoint',
    'idx_staging_posts_article'
  ];

  for (const index of indexes) {
    const result = await turso.execute({
      sql: `SELECT name FROM sqlite_master WHERE type='index' AND name=?`,
      args: [index]
    });
    const exists = result.rows.length > 0;
    console.log(`   ${exists ? '✅' : '❌'} ${index}`);
  }

  // Check live table updates
  console.log('\n🔄 Live Table Columns:');
  const liveTables = ['stories', 'viewpoints', 'social_posts'];

  for (const table of liveTables) {
    try {
      const result = await turso.execute(`PRAGMA table_info(${table})`);
      const hasUpdatedAt = result.rows.some(
        (row: any) => row.name === 'updated_at'
      );
      console.log(`   ${hasUpdatedAt ? '✅' : '❌'} ${table}.updated_at`);
    } catch (err) {
      console.log(`   ❌ ${table} (table not found)`);
    }
  }

  // Check triggers
  console.log('\n⚡ Triggers:');
  const triggers = [
    'update_stories_timestamp',
    'update_viewpoints_timestamp',
    'update_posts_timestamp'
  ];

  for (const trigger of triggers) {
    const result = await turso.execute({
      sql: `SELECT name FROM sqlite_master WHERE type='trigger' AND name=?`,
      args: [trigger]
    });
    const exists = result.rows.length > 0;
    console.log(`   ${exists ? '✅' : '❌'} ${trigger}`);
  }

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================
  console.log('\n' + '=' .repeat(70));
  console.log('MIGRATION COMPLETE');
  console.log('=' .repeat(70));

  const totalSuccess = stagingSuccess + liveSuccess;
  const totalSkipped = stagingSkipped + liveSkipped;
  const totalFailed = stagingFailed + liveFailed;

  console.log(`\n✅ Successfully executed: ${totalSuccess} statements`);
  console.log(`⏭️  Skipped (already exists): ${totalSkipped} statements`);
  console.log(`❌ Failed: ${totalFailed} statements`);

  if (totalFailed === 0) {
    console.log('\n🎉 All migrations completed successfully!');
    console.log('\nNext steps:');
    console.log('   1. ✅ Schema is ready');
    console.log('   2. 🔧 Build db-staging.ts helper module');
    console.log('   3. 🔧 Build run-manager.ts');
    console.log('   4. 🚀 Start ingestion pipeline development');
  } else {
    console.log('\n⚠️  Some migrations failed. Review errors above.');
  }
}

runMigrations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
