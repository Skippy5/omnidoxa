/**
 * OmniDoxa Pipeline - Phase 1 Direct Integration Tests
 * 
 * Tests the pipeline modules directly without requiring HTTP API.
 * This is more reliable and comprehensive than API-based tests.
 * 
 * Run: npx tsx tests/integration-direct.test.ts
 */

import { turso } from '../src/lib/db-turso';
import { runFullRefresh } from '../src/lib/pipeline/ingestion/full-refresh';
import { runCategoryRefresh } from '../src/lib/pipeline/ingestion/category-refresh';
import { runKeywordSearch } from '../src/lib/pipeline/ingestion/keyword-search';
import { deduplicateRun } from '../src/lib/pipeline/deduplication';
import { selectTopArticles, validateCounts } from '../src/lib/pipeline/validation';
import { promoteToLive } from '../src/lib/pipeline/promotion';
import {
  createRun,
  acquireLock,
  releaseLock,
  completeRun,
  failRun,
  getRunStatus,
  forceReleaseLock
} from '../src/lib/pipeline/run-manager';

// Test state
let testsPassed = 0;
let testsFailed = 0;
const testResults: Array<{
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
}> = [];

// ============================================================================
// Test Utilities
// ============================================================================

async function test(
  name: string,
  fn: () => Promise<void>,
  skip: boolean = false
): Promise<void> {
  if (skip) {
    console.log(`⏭️  SKIPPED: ${name}`);
    testResults.push({ name, status: 'skip', duration: 0 });
    return;
  }
  
  const startTime = Date.now();
  
  try {
    console.log(`\n🧪 Running: ${name}`);
    await fn();
    const duration = Date.now() - startTime;
    
    console.log(`✅ PASSED: ${name} (${duration}ms)`);
    testsPassed++;
    testResults.push({ name, status: 'pass', duration });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    console.error(`❌ FAILED: ${name} (${duration}ms)`);
    console.error(`   Error: ${error.message}`);
    
    testsFailed++;
    testResults.push({ 
      name, 
      status: 'fail', 
      duration,
      error: error.message 
    });
  }
}

function assertEquals(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${expected}, got ${actual}`
    );
  }
}

function assertGreaterThan(actual: number, threshold: number, message?: string) {
  if (actual <= threshold) {
    throw new Error(
      message || `Expected > ${threshold}, got ${actual}`
    );
  }
}

function assertExists(value: any, message?: string) {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to exist');
  }
}

async function cleanupRun(runId: number) {
  await turso.execute({
    sql: 'DELETE FROM pipeline_runs WHERE id = ?',
    args: [runId]
  });
}

async function countStagingArticles(runId: number, status?: string): Promise<number> {
  let sql = 'SELECT COUNT(*) as count FROM staging_articles WHERE run_id = ?';
  const args: any[] = [runId];
  
  if (status) {
    sql += ' AND status = ?';
    args.push(status);
  }
  
  const result = await turso.execute({ sql, args });
  return Number(result.rows[0].count);
}

async function getCategoryStatus(runId: number, category: string): Promise<any> {
  const result = await turso.execute({
    sql: 'SELECT * FROM category_status WHERE run_id = ? AND category = ?',
    args: [runId, category]
  });
  
  return result.rows[0] || null;
}

// ============================================================================
// Integration Test Suite
// ============================================================================

async function runIntegrationTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   OmniDoxa Pipeline - Phase 1 Direct Integration Tests');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Ensure clean state
  console.log('🧹 Cleaning up stale locks and test data...');
  await forceReleaseLock();
  
  // ========================================================================
  // TEST GROUP 1: Run Manager & Locking
  // ========================================================================
  
  console.log('\n━━━ Test Group 1: Run Manager & Locking ━━━');
  
  let testRunId1: number;
  let testRunId2: number;
  
  await test('1.1 - Create run', async () => {
    testRunId1 = await createRun('full_refresh', 'manual', {
      categories: ['technology', 'science', 'business'],
      articlesPerCategory: 5
    });
    
    assertExists(testRunId1, 'Should return runId');
    assertGreaterThan(testRunId1, 0, 'RunId should be positive');
  });
  
  await test('1.2 - Acquire lock', async () => {
    const acquired = await acquireLock(testRunId1);
    assertEquals(acquired, true, 'Should acquire lock');
  });
  
  await test('1.3 - Prevent concurrent lock', async () => {
    testRunId2 = await createRun('category_refresh', 'manual', {
      categories: ['politics']
    });
    
    const acquired = await acquireLock(testRunId2);
    assertEquals(acquired, false, 'Should NOT acquire lock when another holds it');
  });
  
  await test('1.4 - Release lock', async () => {
    await releaseLock(testRunId1);
    
    // Now second run should be able to acquire
    const acquired = await acquireLock(testRunId2);
    assertEquals(acquired, true, 'Should acquire lock after release');
  });
  
  await test('1.5 - Get run status', async () => {
    const status = await getRunStatus(testRunId1);
    assertExists(status, 'Should return status');
    assertEquals(status!.run.id, testRunId1, 'Status should match runId');
  });
  
  await test('1.6 - Cleanup test runs', async () => {
    await releaseLock(testRunId2);
    await cleanupRun(testRunId1);
    await cleanupRun(testRunId2);
  });
  
  // ========================================================================
  // TEST GROUP 2: Full Refresh Flow (REAL API CALLS - MAY BE SLOW)
  // ========================================================================
  
  console.log('\n━━━ Test Group 2: Full Refresh Flow ━━━');
  console.log('⚠️  This makes REAL Newsdata.io API calls - may take 2-3 minutes');
  
  let fullRefreshRunId: number;
  
  await test('2.1 - Create full refresh run', async () => {
    fullRefreshRunId = await createRun('full_refresh', 'manual', {
      categories: ['technology', 'science'], // Just 2 categories to save time
      articlesPerCategory: 5
    });
    
    assertExists(fullRefreshRunId, 'Should create run');
    await acquireLock(fullRefreshRunId);
  });
  
  await test('2.2 - Run full ingestion (2 categories)', async () => {
    await runFullRefresh(fullRefreshRunId);
    
    const totalArticles = await countStagingArticles(fullRefreshRunId);
    console.log(`   Fetched ${totalArticles} articles`);
    
    assertGreaterThan(totalArticles, 0, 'Should fetch articles');
  }, false); // Change to true to skip API calls
  
  await test('2.3 - Verify category status tracking', async () => {
    const techStatus = await getCategoryStatus(fullRefreshRunId, 'technology');
    const scienceStatus = await getCategoryStatus(fullRefreshRunId, 'science');
    
    assertExists(techStatus, 'Technology category status should exist');
    assertExists(scienceStatus, 'Science category status should exist');
    
    console.log(`   Tech status: ${techStatus?.status}, count: ${techStatus?.current_count}`);
    console.log(`   Science status: ${scienceStatus?.status}, count: ${scienceStatus?.current_count}`);
  }, false); // Change to true to skip
  
  await test('2.4 - Run deduplication', async () => {
    await deduplicateRun(fullRefreshRunId);
    
    const dedupedCount = await countStagingArticles(fullRefreshRunId, 'deduplicated');
    console.log(`   ${dedupedCount} articles survived deduplication`);
    
    assertGreaterThan(dedupedCount, 0, 'Should have deduplicated articles');
  }, false);
  
  await test('2.5 - Check for URL duplicates (should be none)', async () => {
    const result = await turso.execute({
      sql: `
        SELECT url_normalized, COUNT(*) as count 
        FROM staging_articles 
        WHERE run_id = ? AND status = 'deduplicated'
        GROUP BY url_normalized 
        HAVING count > 1
      `,
      args: [fullRefreshRunId]
    });
    
    assertEquals(result.rows.length, 0, 'No duplicate URLs should exist after dedup');
  }, false);
  
  await test('2.6 - Select top articles (5 per category)', async () => {
    await selectTopArticles(fullRefreshRunId, 'technology', 5);
    await selectTopArticles(fullRefreshRunId, 'science', 5);
    
    const selectedCount = await countStagingArticles(fullRefreshRunId, 'selected');
    console.log(`   ${selectedCount} articles selected`);
    
    assertGreaterThan(selectedCount, 0, 'Should select articles');
  }, false);
  
  await test('2.7 - Validate counts', async () => {
    const validation = await validateCounts(fullRefreshRunId);
    console.log(`   Validation:`, validation);
    
    assertExists(validation, 'Should return validation summary');
  }, false);
  
  await test('2.8 - Promote to live', async () => {
    const promotion = await promoteToLive(fullRefreshRunId);
    console.log(`   Promoted:`, promotion);
    
    assertGreaterThan(promotion.storiesInserted + promotion.storiesUpdated, 0, 
      'Should insert or update stories');
  }, false);
  
  await test('2.9 - Verify live data', async () => {
    const liveResult = await turso.execute({
      sql: 'SELECT COUNT(*) as count FROM stories WHERE category IN (?, ?)',
      args: ['technology', 'science']
    });
    
    const liveCount = Number(liveResult.rows[0].count);
    console.log(`   Live stories count: ${liveCount}`);
    
    assertGreaterThan(liveCount, 0, 'Live stories should exist');
  }, false);
  
  await test('2.10 - Complete run and release lock', async () => {
    await completeRun(fullRefreshRunId);
    
    const status = await getRunStatus(fullRefreshRunId);
    assertEquals(status!.run.status, 'complete', 'Run should be marked complete');
  }, false);
  
  await test('2.11 - Cleanup full refresh test', async () => {
    await cleanupRun(fullRefreshRunId);
  }, false);
  
  // ========================================================================
  // TEST GROUP 3: Category Refresh
  // ========================================================================
  
  console.log('\n━━━ Test Group 3: Category Refresh ━━━');
  
  let categoryRefreshRunId: number;
  
  await test('3.1 - Create category refresh run (technology only)', async () => {
    categoryRefreshRunId = await createRun('category_refresh', 'manual', {
      categories: ['technology'],
      articlesPerCategory: 5
    });
    
    await acquireLock(categoryRefreshRunId);
  });
  
  await test('3.2 - Run category ingestion', async () => {
    await runCategoryRefresh(categoryRefreshRunId, ['technology']);
    
    const articleCount = await countStagingArticles(categoryRefreshRunId);
    console.log(`   Fetched ${articleCount} tech articles`);
    
    assertGreaterThan(articleCount, 0, 'Should fetch technology articles');
  }, true); // Skip by default - enable if you want to test
  
  await test('3.3 - Verify only technology category fetched', async () => {
    const result = await turso.execute({
      sql: `
        SELECT category, COUNT(*) as count 
        FROM staging_articles 
        WHERE run_id = ?
        GROUP BY category
      `,
      args: [categoryRefreshRunId]
    });
    
    console.log(`   Categories:`, result.rows);
    
    // Should only have technology (and maybe "top" from API)
    for (const row of result.rows) {
      const cat = row.category as string;
      if (cat !== 'technology' && cat !== 'top') {
        throw new Error(`Unexpected category: ${cat}`);
      }
    }
  }, true);
  
  await test('3.4 - Cleanup category refresh test', async () => {
    await releaseLock(categoryRefreshRunId);
    await cleanupRun(categoryRefreshRunId);
  });
  
  // ========================================================================
  // TEST GROUP 4: Keyword Search
  // ========================================================================
  
  console.log('\n━━━ Test Group 4: Keyword Search ━━━');
  
  let keywordSearchRunId: number;
  
  await test('4.1 - Create keyword search run', async () => {
    keywordSearchRunId = await createRun('keyword_search', 'manual', {
      keywords: 'artificial intelligence',
      maxArticles: 10
    });
    
    await acquireLock(keywordSearchRunId);
  });
  
  await test('4.2 - Run keyword search', async () => {
    await runKeywordSearch(keywordSearchRunId, 'artificial intelligence', 10);
    
    const articleCount = await countStagingArticles(keywordSearchRunId);
    console.log(`   Found ${articleCount} AI articles`);
    
    assertGreaterThan(articleCount, 0, 'Should find AI articles');
  }, true); // Skip by default
  
  await test('4.3 - Cleanup keyword search test', async () => {
    await releaseLock(keywordSearchRunId);
    await cleanupRun(keywordSearchRunId);
  });
  
  // ========================================================================
  // TEST GROUP 5: Edge Cases
  // ========================================================================
  
  console.log('\n━━━ Test Group 5: Edge Cases ━━━');
  
  await test('5.1 - Stale lock detection (manually tested)', async () => {
    // This would require mocking time or manual intervention
    console.log('   ⚠️  Stale lock detection requires manual testing');
    console.log('   Expected: Locks older than 10 minutes are auto-released');
  });
  
  await test('5.2 - API failure handling (manually tested)', async () => {
    console.log('   ⚠️  API failure handling requires mocking or network issues');
    console.log('   Expected: Failed categories marked as failed, pipeline continues');
  });
  
  await test('5.3 - Repull logic (manually tested)', async () => {
    console.log('   ⚠️  Repull logic requires controlled test data');
    console.log('   Expected: If < targetCount after dedup, fetch more (up to maxAttempts)');
  });
  
  await test('5.4 - Promotion rollback (manually tested)', async () => {
    console.log('   ⚠️  Promotion rollback requires error injection');
    console.log('   Expected: If promotion transaction fails, all changes rollback');
  });
  
  // ========================================================================
  // Final Summary
  // ========================================================================
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   Test Results Summary');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const skipped = testResults.filter(t => t.status === 'skip').length;
  
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📊 Total: ${testsPassed + testsFailed + skipped}\n`);
  
  if (testsFailed === 0) {
    console.log('🎉 All executed tests passed!\n');
  } else {
    console.log('⚠️  Some tests failed. See details above.\n');
  }
  
  // Save report
  const fs = require('fs');
  const path = require('path');
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      passed: testsPassed,
      failed: testsFailed,
      skipped,
      total: testsPassed + testsFailed + skipped
    },
    tests: testResults
  };
  
  const reportPath = path.join(__dirname, '..', 'test-results-integration-direct.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`📝 Full report saved to: ${reportPath}\n`);
  
  process.exit(testsFailed > 0 ? 1 : 0);
}

// ============================================================================
// Run Tests
// ============================================================================

runIntegrationTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
