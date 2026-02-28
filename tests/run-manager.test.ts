/**
 * Integration tests for run manager module
 * Tests locking mechanism and run lifecycle
 * 
 * NOTE: These tests require the staging tables to exist in the database.
 * Run the schema creation script first.
 * 
 * Run with: npx tsx tests/run-manager.test.ts
 */

import {
  createRun,
  acquireLock,
  releaseLock,
  getLockStatus,
  getRunStatus,
  completeRun,
  failRun,
  cancelRun,
  isRunInProgress,
  getActiveRun,
  forceReleaseLock,
  updateRunStatus
} from '../src/lib/pipeline/run-manager';

import { getRun } from '../src/lib/db-staging';

// Test utilities
let passed = 0;
let failed = 0;
let createdRunIds: number[] = [];

function test(name: string, fn: () => Promise<void>) {
  return async () => {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.error(`❌ ${name}`);
      console.error(`   ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  };
}

function assertEquals(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertTrue(value: boolean, message?: string) {
  if (!value) {
    throw new Error(message || 'Expected true, got false');
  }
}

function assertFalse(value: boolean, message?: string) {
  if (value) {
    throw new Error(message || 'Expected false, got true');
  }
}

function assertNotNull<T>(value: T | null, message?: string): asserts value is T {
  if (value === null) {
    throw new Error(message || 'Expected non-null value');
  }
}

// ============================================================================
// CLEANUP
// ============================================================================

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...\n');
  
  // Force release any locks
  await forceReleaseLock();
  
  // Note: In a real test environment, you'd want to delete test runs
  // For now, we'll just release locks and trust cascade deletes
  
  console.log('✅ Cleanup complete\n');
}

// ============================================================================
// LOCK TESTS
// ============================================================================

console.log('\n🔐 Testing Lock Mechanism...\n');

const testLockAcquisition = test('can acquire lock for new run', async () => {
  await forceReleaseLock(); // Ensure clean state
  
  const runId = await createRun('full_refresh', 'manual', { categories: ['technology'] });
  createdRunIds.push(runId);
  
  const lockStatus = await getLockStatus();
  assertNotNull(lockStatus, 'Lock should be acquired');
  assertEquals(lockStatus.runId, runId, 'Lock should belong to created run');
  
  // Clean up
  await releaseLock(runId);
});

const testLockPreventsSecondRun = test('lock prevents concurrent runs', async () => {
  await forceReleaseLock(); // Clean state
  
  // First run should succeed
  const runId1 = await createRun('category_refresh', 'manual', { categories: ['politics'] });
  createdRunIds.push(runId1);
  
  // Second run should fail
  let secondRunFailed = false;
  try {
    await createRun('full_refresh', 'manual', { categories: ['technology'] });
  } catch (error) {
    secondRunFailed = true;
    assertTrue(
      error instanceof Error && error.message.includes('already in progress'),
      'Should throw "already in progress" error'
    );
  }
  
  assertTrue(secondRunFailed, 'Second run should have failed');
  
  // Clean up
  await releaseLock(runId1);
});

const testLockRelease = test('can release lock', async () => {
  await forceReleaseLock(); // Clean state
  
  const runId = await createRun('keyword_search', 'manual', { keywords: 'test' });
  createdRunIds.push(runId);
  
  // Verify lock exists
  let lockStatus = await getLockStatus();
  assertNotNull(lockStatus);
  
  // Release lock
  await releaseLock(runId);
  
  // Verify lock is gone
  lockStatus = await getLockStatus();
  assertEquals(lockStatus, null, 'Lock should be released');
});

const testLockReleaseOnComplete = test('completeRun() releases lock', async () => {
  await forceReleaseLock();
  
  const runId = await createRun('full_refresh', 'cron', { categories: ['technology'] });
  createdRunIds.push(runId);
  
  await completeRun(runId);
  
  const lockStatus = await getLockStatus();
  assertEquals(lockStatus, null, 'Lock should be released after completion');
  
  const run = await getRun(runId);
  assertNotNull(run);
  assertEquals(run.status, 'complete');
});

const testLockReleaseOnFail = test('failRun() releases lock', async () => {
  await forceReleaseLock();
  
  const runId = await createRun('category_refresh', 'manual', { categories: ['science'] });
  createdRunIds.push(runId);
  
  await failRun(runId, 'Test error');
  
  const lockStatus = await getLockStatus();
  assertEquals(lockStatus, null, 'Lock should be released after failure');
  
  const run = await getRun(runId);
  assertNotNull(run);
  assertEquals(run.status, 'failed');
  assertEquals(run.error_message, 'Test error');
});

const testLockReleaseOnCancel = test('cancelRun() releases lock', async () => {
  await forceReleaseLock();
  
  const runId = await createRun('full_refresh', 'conversational', { categories: ['world'] });
  createdRunIds.push(runId);
  
  await cancelRun(runId);
  
  const lockStatus = await getLockStatus();
  assertEquals(lockStatus, null, 'Lock should be released after cancellation');
  
  const run = await getRun(runId);
  assertNotNull(run);
  assertEquals(run.status, 'cancelled');
});

// ============================================================================
// RUN STATUS TESTS
// ============================================================================

console.log('\n📊 Testing Run Status...\n');

const testGetRunStatus = test('getRunStatus() returns detailed info', async () => {
  await forceReleaseLock();
  
  const runId = await createRun('category_refresh', 'manual', { 
    categories: ['technology'],
    targetCount: 5
  });
  createdRunIds.push(runId);
  
  const status = await getRunStatus(runId);
  assertNotNull(status);
  
  assertEquals(status.run.id, runId);
  assertEquals(status.run.status, 'running');
  assertTrue(status.progress.percent >= 0 && status.progress.percent <= 100);
  assertTrue(status.progress.stage.length > 0);
  assertTrue(Array.isArray(status.errors));
  
  await releaseLock(runId);
});

const testUpdateRunStatus = test('updateRunStatus() updates stage', async () => {
  await forceReleaseLock();
  
  const runId = await createRun('full_refresh', 'cron', { categories: ['business'] });
  createdRunIds.push(runId);
  
  await updateRunStatus(runId, 'analyzing', 'Running Twitter analysis');
  
  const run = await getRun(runId);
  assertNotNull(run);
  assertEquals(run.status, 'analyzing');
  assertEquals(run.current_stage, 'Running Twitter analysis');
  
  await releaseLock(runId);
});

const testIsRunInProgress = test('isRunInProgress() detects active runs', async () => {
  await forceReleaseLock();
  
  // No run in progress
  let inProgress = await isRunInProgress();
  assertFalse(inProgress, 'Should be false initially');
  
  // Create run
  const runId = await createRun('keyword_search', 'manual', { keywords: 'AI' });
  createdRunIds.push(runId);
  
  // Should detect run
  inProgress = await isRunInProgress();
  assertTrue(inProgress, 'Should detect active run');
  
  // Complete run
  await completeRun(runId);
  
  // Should be false again
  inProgress = await isRunInProgress();
  assertFalse(inProgress, 'Should be false after completion');
});

const testGetActiveRun = test('getActiveRun() returns current run', async () => {
  await forceReleaseLock();
  
  // No active run
  let activeRun = await getActiveRun();
  assertEquals(activeRun, null, 'Should be null initially');
  
  // Create run
  const runId = await createRun('full_refresh', 'conversational', { 
    categories: ['entertainment'] 
  });
  createdRunIds.push(runId);
  
  // Should return active run
  activeRun = await getActiveRun();
  assertNotNull(activeRun);
  assertEquals(activeRun.id, runId);
  
  await releaseLock(runId);
});

// ============================================================================
// RUN TESTS
// ============================================================================

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Run Manager Test Suite');
  console.log('='.repeat(60));
  
  // Lock tests
  await testLockAcquisition();
  await testLockPreventsSecondRun();
  await testLockRelease();
  await testLockReleaseOnComplete();
  await testLockReleaseOnFail();
  await testLockReleaseOnCancel();
  
  // Status tests
  await testGetRunStatus();
  await testUpdateRunStatus();
  await testIsRunInProgress();
  await testGetActiveRun();
  
  // Cleanup
  await cleanup();
  
  // Summary
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${passed + failed}`);
  console.log('='.repeat(60) + '\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
