# OmniDoxa Pipeline Tests

This directory contains unit and integration tests for the OmniDoxa modular pipeline.

## Test Files

### `text-processing.test.ts`
Unit tests for text normalization and deduplication utilities.

**Tests:**
- URL normalization (removes UTM params, www, trailing slashes)
- Title normalization (lowercase, no punctuation, collapsed whitespace)
- Content hashing (SHA-256, deterministic)
- Jaccard similarity (fuzzy matching)
- Levenshtein distance (edit distance)
- Fuzzy duplicate detection

**Run:**
```bash
cd ~/Projects/omnidoxa
npx tsx tests/text-processing.test.ts
```

**Expected output:**
```
✅ Passed: 45
❌ Failed: 0
📊 Total: 45
```

---

### `run-manager.test.ts`
Integration tests for run manager and locking mechanism.

**Tests:**
- Lock acquisition and release
- Concurrent run prevention
- Lock release on completion/failure/cancellation
- Run status queries
- Active run detection

**Prerequisites:**
- Staging tables must exist in database
- Database connection configured (`.env` file)

**Run:**
```bash
cd ~/Projects/omnidoxa
npx tsx tests/run-manager.test.ts
```

**Expected output:**
```
✅ Passed: 10
❌ Failed: 0
📊 Total: 10
```

**Notes:**
- Tests create real database entries (with cleanup)
- Uses `pipeline_lock` table (singleton pattern)
- Safe to run against development database

---

### `db-staging.test.ts` (TODO)
Integration tests for database staging helpers.

**Will test:**
- Run creation and status updates
- Category status tracking
- Article insertion (single and bulk)
- Article status updates
- Analysis job creation and updates
- Query filters

---

## Running All Tests

```bash
# Run all tests sequentially
npm run test

# Or manually:
npx tsx tests/text-processing.test.ts && \
npx tsx tests/run-manager.test.ts
```

---

## Test Database Setup

Before running integration tests, ensure staging tables exist:

```bash
# Apply staging schema (once per database)
turso db shell omnidoxa < src/lib/db/schema-staging.sql
```

Or manually create tables via the Turso dashboard using the schema from the master plan.

---

## Writing New Tests

### Unit Tests (no database)
```typescript
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error}`);
    failed++;
  }
}

test('your test name', () => {
  const result = yourFunction();
  assertEquals(result, expectedValue);
});
```

### Integration Tests (with database)
```typescript
const testName = test('your test description', async () => {
  const runId = await createRun(...);
  const result = await yourFunction(runId);
  
  assertNotNull(result);
  assertEquals(result.status, 'expected');
  
  // Cleanup
  await cleanup(runId);
});

// Execute in test runner
await testName();
```

---

## CI/CD Integration (Future)

When adding to GitHub Actions:

```yaml
- name: Run Tests
  run: |
    npm run test
  env:
    TURSO_DATABASE_URL: ${{ secrets.TURSO_DATABASE_URL }}
    TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
```

---

## Test Coverage Goals

- **text-processing.ts:** 100% (pure functions, easy to test)
- **db-staging.ts:** 90%+ (all CRUD operations)
- **run-manager.ts:** 90%+ (all lock scenarios)
- **Deduplication:** 95%+ (critical logic, all 4 layers)
- **Orchestrator:** 80%+ (integration-heavy, some manual testing)

---

## Debugging Failed Tests

**Lock already held:**
```bash
# Force release stale lock
npx tsx -e "
import { forceReleaseLock } from './src/lib/pipeline/run-manager';
await forceReleaseLock();
console.log('Lock released');
"
```

**Database connection issues:**
- Check `.env` file has `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
- Verify tables exist: `turso db shell omnidoxa .tables`

**Test data pollution:**
- Tests include cleanup functions
- Manually clean: `DELETE FROM pipeline_runs WHERE trigger_source = 'manual'`

---

## Performance Benchmarks

Target performance for key operations:

| Operation | Target Time | Notes |
|-----------|-------------|-------|
| `normalizeUrl()` | <1ms | Pure function |
| `contentHash()` | <5ms | SHA-256 hashing |
| `jaccardSimilarity()` | <1ms | Set operations |
| `createRun()` | <100ms | Single DB insert + lock |
| `bulkInsertStagingArticles(50)` | <500ms | Batch insert |
| `getRunStatus()` | <200ms | Multiple queries |

Run benchmarks with:
```bash
npx tsx tests/benchmarks.test.ts
```
(TODO: Create benchmark suite)

---

**Last Updated:** 2026-02-28  
**Maintainer:** Skippy the Magnificent 🍺
