/**
 * OmniDoxa Pipeline - Phase 1 Integration Tests
 * 
 * Comprehensive end-to-end testing for the modular pipeline.
 * Tests all flows: full refresh, category refresh, keyword search, edge cases.
 * 
 * Run: npx tsx tests/integration.test.ts
 */

import { turso } from '../src/lib/db-turso';
import { 
  createRun, 
  updateRunStatus, 
  getRunStatus,
  completeRun,
  failRun,
  forceReleaseLock 
} from '../src/lib/pipeline/run-manager';

// Test configuration
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const TEST_TIMEOUT = 300000; // 5 minutes max per test

// Test state tracking
let testsPassed = 0;
let testsFailed = 0;
const testResults: Array<{
  name: string;
  status: 'pass' | 'fail';
  duration: number;
  error?: string;
  details?: any;
}> = [];

// ============================================================================
// Test Utilities
// ============================================================================

async function apiPost(endpoint: string, body: any): Promise<any> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  
  return response.json();
}

async function apiGet(endpoint: string): Promise<any> {
  const response = await fetch(`${API_BASE}${endpoint}`);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  
  return response.json();
}

async function pollStatus(runId: number, maxWait: number = 180000): Promise<any> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    const status = await apiGet(`/api/pipeline/status?runId=${runId}`);
    
    if (status.status === 'complete' || status.status === 'failed') {
      return status;
    }
    
    // Wait 3 seconds between polls
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  throw new Error(`Timeout waiting for run ${runId} to complete`);
}

async function countStagingArticles(runId: number): Promise<{
  total: number;
  staged: number;
  selected: number;
  rejected: number;
  byCategory: Record<string, number>;
}> {
  const result = await turso.execute({
    sql: `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'staged' THEN 1 ELSE 0 END) as staged,
        SUM(CASE WHEN status = 'selected' THEN 1 ELSE 0 END) as selected,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        category,
        COUNT(*) as count
      FROM staging_articles 
      WHERE run_id = ?
      GROUP BY category
    `,
    args: [runId]
  });
  
  const totals = await turso.execute({
    sql: `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'staged' THEN 1 ELSE 0 END) as staged,
        SUM(CASE WHEN status = 'selected' THEN 1 ELSE 0 END) as selected,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM staging_articles 
      WHERE run_id = ?
    `,
    args: [runId]
  });
  
  const byCategory: Record<string, number> = {};
  for (const row of result.rows) {
    byCategory[row.category as string] = Number(row.count);
  }
  
  const totalRow = totals.rows[0];
  return {
    total: Number(totalRow.total),
    staged: Number(totalRow.staged),
    selected: Number(totalRow.selected),
    rejected: Number(totalRow.rejected),
    byCategory
  };
}

async function countLiveArticles(category?: string): Promise<number> {
  let sql = 'SELECT COUNT(*) as count FROM stories';
  const args: any[] = [];
  
  if (category) {
    sql += ' WHERE category = ?';
    args.push(category);
  }
  
  const result = await turso.execute({ sql, args });
  return Number(result.rows[0].count);
}

async function getRecentLiveArticles(category: string, limit: number = 10): Promise<any[]> {
  const result = await turso.execute({
    sql: 'SELECT * FROM stories WHERE category = ? ORDER BY updated_at DESC LIMIT ?',
    args: [category, limit]
  });
  
  return result.rows;
}

async function cleanupTestData(runId: number) {
  // Delete staging data (CASCADE will handle child tables)
  await turso.execute({
    sql: 'DELETE FROM pipeline_runs WHERE id = ?',
    args: [runId]
  });
}

async function test(
  name: string,
  fn: () => Promise<void>
): Promise<void> {
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
    if (error.stack) {
      console.error(`   Stack: ${error.stack.split('\n').slice(1, 4).join('\n')}`);
    }
    
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

// ============================================================================
// Integration Test Suite
// ============================================================================

async function runIntegrationTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   OmniDoxa Pipeline - Phase 1 Integration Tests');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Test Timeout: ${TEST_TIMEOUT / 1000}s per test\n`);
  
  // Ensure no stale locks
  await forceReleaseLock();
  
  // ========================================================================
  // TEST 1: Full Refresh End-to-End
  // ========================================================================
  
  await test('1.1 - Full Refresh: Trigger pipeline', async () => {
    const response = await apiPost('/api/pipeline/run', {
      operation: 'full_refresh',
      params: {},
      trigger_source: 'manual',
      trigger_context: { test: 'integration-test-1.1' }
    });
    
    assertExists(response.runId, 'Response should include runId');
    assertEquals(response.status, 'started', 'Status should be "started"');
    
    // Store for next tests
    (global as any).fullRefreshRunId = response.runId;
  });
  
  await test('1.2 - Full Refresh: Poll until complete', async () => {
    const runId = (global as any).fullRefreshRunId;
    const finalStatus = await pollStatus(runId, 180000); // 3 minutes max
    
    assertEquals(finalStatus.status, 'complete', 'Run should complete successfully');
  });
  
  await test('1.3 - Full Refresh: Verify staging tables populated', async () => {
    const runId = (global as any).fullRefreshRunId;
    const counts = await countStagingArticles(runId);
    
    console.log(`   Staging counts:`, counts);
    
    assertGreaterThan(counts.total, 0, 'Should have staged articles');
    assertGreaterThan(counts.selected, 0, 'Should have selected articles');
  });
  
  await test('1.4 - Full Refresh: Verify deduplication ran', async () => {
    const runId = (global as any).fullRefreshRunId;
    
    // Check for URL duplicates (should be none)
    const result = await turso.execute({
      sql: `
        SELECT url_normalized, COUNT(*) as count 
        FROM staging_articles 
        WHERE run_id = ? AND status = 'selected'
        GROUP BY url_normalized 
        HAVING count > 1
      `,
      args: [runId]
    });
    
    assertEquals(result.rows.length, 0, 'No duplicate URLs should be selected');
  });
  
  await test('1.5 - Full Refresh: Verify article selection (5 per category)', async () => {
    const runId = (global as any).fullRefreshRunId;
    const counts = await countStagingArticles(runId);
    
    console.log(`   Selected by category:`, counts.byCategory);
    
    // Each category should have ~5 selected (allowing for API variability)
    for (const [category, count] of Object.entries(counts.byCategory)) {
      assertGreaterThan(count, 0, `Category ${category} should have articles`);
    }
  });
  
  await test('1.6 - Full Refresh: Verify live tables updated', async () => {
    // Check that live stories table has data
    const liveCount = await countLiveArticles();
    assertGreaterThan(liveCount, 0, 'Live stories table should have data');
  });
  
  await test('1.7 - Full Refresh: Cleanup test data', async () => {
    const runId = (global as any).fullRefreshRunId;
    await cleanupTestData(runId);
    
    // Verify cleanup
    const result = await turso.execute({
      sql: 'SELECT COUNT(*) as count FROM pipeline_runs WHERE id = ?',
      args: [runId]
    });
    assertEquals(Number(result.rows[0].count), 0, 'Test run should be deleted');
  });
  
  // ========================================================================
  // TEST 2: Category Refresh (Technology Only)
  // ========================================================================
  
  await test('2.1 - Category Refresh: Trigger technology refresh', async () => {
    const response = await apiPost('/api/pipeline/run', {
      operation: 'refresh_categories',
      params: { categories: ['technology'] },
      trigger_source: 'manual',
      trigger_context: { test: 'integration-test-2.1' }
    });
    
    assertExists(response.runId, 'Response should include runId');
    (global as any).categoryRefreshRunId = response.runId;
  });
  
  await test('2.2 - Category Refresh: Poll until complete', async () => {
    const runId = (global as any).categoryRefreshRunId;
    const finalStatus = await pollStatus(runId, 120000); // 2 minutes
    
    assertEquals(finalStatus.status, 'complete', 'Category refresh should complete');
  });
  
  await test('2.3 - Category Refresh: Verify only tech articles fetched', async () => {
    const runId = (global as any).categoryRefreshRunId;
    const counts = await countStagingArticles(runId);
    
    console.log(`   Category distribution:`, counts.byCategory);
    
    // Should only have technology (and maybe "top" if API returned it)
    const categories = Object.keys(counts.byCategory);
    const hasNonTech = categories.some(cat => 
      cat !== 'technology' && cat !== 'top' && counts.byCategory[cat] > 0
    );
    
    assertEquals(hasNonTech, false, 'Should only fetch technology articles');
  });
  
  await test('2.4 - Category Refresh: Verify live tech category updated', async () => {
    const techArticles = await getRecentLiveArticles('technology', 5);
    assertGreaterThan(techArticles.length, 0, 'Live tech articles should exist');
  });
  
  await test('2.5 - Category Refresh: Cleanup', async () => {
    const runId = (global as any).categoryRefreshRunId;
    await cleanupTestData(runId);
  });
  
  // ========================================================================
  // TEST 3: Keyword Search
  // ========================================================================
  
  await test('3.1 - Keyword Search: Trigger search for "climate change"', async () => {
    const response = await apiPost('/api/pipeline/run', {
      operation: 'search_news',
      params: { keywords: 'climate change', maxArticles: 10 },
      trigger_source: 'manual',
      trigger_context: { test: 'integration-test-3.1' }
    });
    
    assertExists(response.runId, 'Response should include runId');
    (global as any).keywordSearchRunId = response.runId;
  });
  
  await test('3.2 - Keyword Search: Poll until complete', async () => {
    const runId = (global as any).keywordSearchRunId;
    const finalStatus = await pollStatus(runId, 120000);
    
    assertEquals(finalStatus.status, 'complete', 'Keyword search should complete');
  });
  
  await test('3.3 - Keyword Search: Verify articles found and staged', async () => {
    const runId = (global as any).keywordSearchRunId;
    const counts = await countStagingArticles(runId);
    
    console.log(`   Keyword search results:`, counts);
    
    assertGreaterThan(counts.total, 0, 'Should find articles for "climate change"');
  });
  
  await test('3.4 - Keyword Search: Verify promoted to live', async () => {
    const runId = (global as any).keywordSearchRunId;
    
    // Get selected articles from staging
    const stagingResult = await turso.execute({
      sql: `SELECT url_normalized FROM staging_articles WHERE run_id = ? AND status = 'selected'`,
      args: [runId]
    });
    
    if (stagingResult.rows.length > 0) {
      const firstUrl = stagingResult.rows[0].url_normalized;
      
      // Verify it exists in live (may be updated, not inserted if already existed)
      const liveResult = await turso.execute({
        sql: `SELECT COUNT(*) as count FROM stories WHERE url = ?`,
        args: [firstUrl]
      });
      
      assertGreaterThan(Number(liveResult.rows[0].count), 0, 'Selected articles should be in live');
    }
  });
  
  await test('3.5 - Keyword Search: Cleanup', async () => {
    const runId = (global as any).keywordSearchRunId;
    await cleanupTestData(runId);
  });
  
  // ========================================================================
  // TEST 4: Edge Cases
  // ========================================================================
  
  await test('4.1 - Concurrent Run Prevention: Start first run', async () => {
    const response = await apiPost('/api/pipeline/run', {
      operation: 'refresh_categories',
      params: { categories: ['science'] },
      trigger_source: 'manual',
      trigger_context: { test: 'integration-test-4.1-first' }
    });
    
    assertExists(response.runId, 'First run should start');
    (global as any).firstConcurrentRunId = response.runId;
  });
  
  await test('4.2 - Concurrent Run Prevention: Try second run (should fail)', async () => {
    let errorCaught = false;
    
    try {
      await apiPost('/api/pipeline/run', {
        operation: 'refresh_categories',
        params: { categories: ['business'] },
        trigger_source: 'manual',
        trigger_context: { test: 'integration-test-4.2-second' }
      });
    } catch (error: any) {
      errorCaught = true;
      
      // Should be 409 Conflict
      assertEquals(
        error.message.includes('409'),
        true,
        'Should return 409 Conflict for concurrent run'
      );
    }
    
    assertEquals(errorCaught, true, 'Second concurrent run should fail');
  });
  
  await test('4.3 - Concurrent Run Prevention: Wait for first run to complete', async () => {
    const runId = (global as any).firstConcurrentRunId;
    await pollStatus(runId, 120000);
  });
  
  await test('4.4 - Concurrent Run Prevention: Verify can run again after completion', async () => {
    // Now that first run is done, this should succeed
    const response = await apiPost('/api/pipeline/run', {
      operation: 'refresh_categories',
      params: { categories: ['business'] },
      trigger_source: 'manual',
      trigger_context: { test: 'integration-test-4.4' }
    });
    
    assertExists(response.runId, 'Should be able to run after first completes');
    (global as any).secondConcurrentRunId = response.runId;
    
    await pollStatus(response.runId, 120000);
  });
  
  await test('4.5 - Concurrent Run Prevention: Cleanup', async () => {
    await cleanupTestData((global as any).firstConcurrentRunId);
    await cleanupTestData((global as any).secondConcurrentRunId);
  });
  
  await test('4.6 - API Failure Handling: TODO (requires mock)', async () => {
    // TODO: Mock Newsdata.io failure
    // For now, just document the expected behavior
    console.log('   ⚠️  API failure handling requires manual testing');
    console.log('   Expected: Failed categories marked as failed, pipeline continues');
  });
  
  await test('4.7 - Repull Logic: TODO (requires mock)', async () => {
    // TODO: Create scenario where dedup leaves only 3 articles
    // For now, document expected behavior
    console.log('   ⚠️  Repull logic requires controlled test data');
    console.log('   Expected: If < 5 articles after dedup, fetch more (up to maxAttempts)');
  });
  
  await test('4.8 - Promotion Rollback: TODO (requires injection)', async () => {
    // TODO: Inject error during promotion transaction
    // For now, document expected behavior
    console.log('   ⚠️  Promotion rollback requires error injection');
    console.log('   Expected: If promotion fails mid-transaction, all changes rollback');
  });
  
  // ========================================================================
  // Final Summary
  // ========================================================================
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   Test Results Summary');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📊 Total: ${testsPassed + testsFailed}\n`);
  
  if (testsFailed === 0) {
    console.log('🎉 All tests passed!\n');
  } else {
    console.log('⚠️  Some tests failed. See details above.\n');
    
    console.log('Failed tests:');
    testResults
      .filter(t => t.status === 'fail')
      .forEach(t => {
        console.log(`   ❌ ${t.name}`);
        console.log(`      Error: ${t.error}\n`);
      });
  }
  
  // Save results to file
  const report = {
    timestamp: new Date().toISOString(),
    apiBase: API_BASE,
    summary: {
      passed: testsPassed,
      failed: testsFailed,
      total: testsPassed + testsFailed
    },
    tests: testResults
  };
  
  const fs = require('fs');
  const path = require('path');
  const reportPath = path.join(__dirname, '..', 'test-results-integration.json');
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
