/**
 * OmniDoxa Pipeline - Test Suite
 * 
 * Tests for modules 1.9-1.12:
 * - Deduplication
 * - Validation
 * - Promotion
 * - Orchestrator
 * 
 * Phase: 1.9-1.12 Testing
 * Created: 2026-02-28
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { turso } from '../src/lib/db-turso';
import { deduplicateRun } from '../src/lib/pipeline/deduplication';
import { selectTopArticles, validateCounts, getValidationSummary } from '../src/lib/pipeline/validation';
import { promoteToLive, getPromotionSummary } from '../src/lib/pipeline/promotion';
import { runPipeline, getPipelineStatus } from '../src/lib/pipeline/orchestrator';
import type { Category } from '../src/lib/types';

// Test helpers
async function createTestRun(operation: string = 'full_refresh'): Promise<number> {
  const result = await turso.execute({
    sql: `INSERT INTO pipeline_runs 
          (run_type, trigger_source, started_at, status, current_stage, config)
          VALUES (?, 'manual', datetime('now'), 'running', 'testing', '{}')`,
    args: [operation]
  });
  return Number(result.lastInsertRowid);
}

async function createTestArticle(runId: number, category: Category, overrides: any = {}): Promise<number> {
  const defaults = {
    title: `Test Article ${Math.random().toString(36).substring(7)}`,
    url: `https://test.com/${Math.random().toString(36).substring(7)}`,
    description: 'Test description',
    source: 'Test Source',
    image_url: null,
    published_at: new Date().toISOString(),
    fetched_at: new Date().toISOString()
  };
  
  const article = { ...defaults, ...overrides };
  
  // Normalize fields
  const urlNormalized = article.url.toLowerCase().replace(/\/$/, '');
  const titleNormalized = article.title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  const contentHash = require('crypto').createHash('sha256').update(`${article.title}|${article.description}`).digest('hex');
  
  const result = await turso.execute({
    sql: `INSERT INTO staging_articles 
          (run_id, category, title, title_normalized, description, url, url_normalized, content_hash, source, image_url, published_at, fetched_at, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'staged')`,
    args: [
      runId, category, article.title, titleNormalized, article.description,
      article.url, urlNormalized, contentHash, article.source,
      article.image_url, article.published_at, article.fetched_at
    ]
  });
  
  return Number(result.lastInsertRowid);
}

async function cleanupTestRun(runId: number): Promise<void> {
  await turso.execute({
    sql: 'DELETE FROM pipeline_runs WHERE id = ?',
    args: [runId]
  });
  // Cascading deletes will clean up related tables
}

// =============================================================================
// DEDUPLICATION TESTS
// =============================================================================

describe('Deduplication Module', () => {
  it('should remove exact URL duplicates (Layer 1)', async () => {
    const runId = await createTestRun();
    
    // Create 3 articles with duplicate URLs
    await createTestArticle(runId, 'technology', { url: 'https://test.com/article1', title: 'Article 1' });
    await createTestArticle(runId, 'technology', { url: 'https://test.com/article1/', title: 'Article 1 Duplicate' }); // Trailing slash
    await createTestArticle(runId, 'technology', { url: 'https://test.com/article2', title: 'Article 2' });
    
    const result = await deduplicateRun(runId);
    
    expect(result.totalArticles).toBe(3);
    expect(result.duplicatesFound).toBeGreaterThanOrEqual(1);
    expect(result.layerStats.layer1_url).toBeGreaterThanOrEqual(1);
    
    await cleanupTestRun(runId);
  });
  
  it('should remove content hash duplicates (Layer 2)', async () => {
    const runId = await createTestRun();
    
    // Create articles with same title/description but different URLs
    await createTestArticle(runId, 'technology', {
      url: 'https://test.com/article1',
      title: 'Breaking News',
      description: 'Important event'
    });
    await createTestArticle(runId, 'technology', {
      url: 'https://test.com/article2',
      title: 'Breaking News',
      description: 'Important event'
    });
    
    const result = await deduplicateRun(runId);
    
    expect(result.totalArticles).toBe(2);
    expect(result.duplicatesFound).toBeGreaterThanOrEqual(1);
    expect(result.layerStats.layer2_hash).toBeGreaterThanOrEqual(1);
    
    await cleanupTestRun(runId);
  });
  
  it('should remove fuzzy title duplicates (Layer 3)', async () => {
    const runId = await createTestRun();
    
    // Create articles with similar titles
    await createTestArticle(runId, 'technology', {
      url: 'https://test.com/article1',
      title: 'Apple Announces New iPhone 16',
      description: 'Description 1'
    });
    await createTestArticle(runId, 'technology', {
      url: 'https://test.com/article2',
      title: 'Apple announces new iphone 16!',
      description: 'Description 2'
    });
    
    const result = await deduplicateRun(runId);
    
    expect(result.totalArticles).toBe(2);
    expect(result.duplicatesFound).toBeGreaterThanOrEqual(1);
    // Fuzzy or hash should catch this
    expect(result.layerStats.layer2_hash + result.layerStats.layer3_fuzzy).toBeGreaterThanOrEqual(1);
    
    await cleanupTestRun(runId);
  });
  
  it('should remove cross-category duplicates (Layer 4)', async () => {
    const runId = await createTestRun();
    
    // Same article in two categories
    await createTestArticle(runId, 'technology', { url: 'https://test.com/article1', title: 'Tech News' });
    await createTestArticle(runId, 'business', { url: 'https://test.com/article1', title: 'Tech News' });
    
    const result = await deduplicateRun(runId);
    
    expect(result.totalArticles).toBe(2);
    expect(result.duplicatesFound).toBeGreaterThanOrEqual(1);
    expect(result.layerStats.layer1_url + result.layerStats.layer4_cross_category).toBeGreaterThanOrEqual(1);
    
    await cleanupTestRun(runId);
  });
  
  it('should complete in <10s for 500 articles', async () => {
    const runId = await createTestRun();
    
    // Create 500 test articles
    const promises = [];
    for (let i = 0; i < 500; i++) {
      promises.push(createTestArticle(runId, 'technology', {
        url: `https://test.com/article${i}`,
        title: `Article ${i}`
      }));
    }
    await Promise.all(promises);
    
    const startTime = Date.now();
    await deduplicateRun(runId);
    const duration = (Date.now() - startTime) / 1000;
    
    expect(duration).toBeLessThan(10);
    
    await cleanupTestRun(runId);
  }, 15000); // 15s timeout
});

// =============================================================================
// VALIDATION TESTS
// =============================================================================

describe('Validation Module', () => {
  it('should select top N articles based on ranking', async () => {
    const runId = await createTestRun();
    
    // Create 10 articles with varying publish dates
    for (let i = 0; i < 10; i++) {
      const hoursAgo = i * 2; // 0, 2, 4, 6... hours ago
      const publishedAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
      await createTestArticle(runId, 'technology', {
        url: `https://test.com/article${i}`,
        title: `Article ${i}`,
        published_at: publishedAt
      });
    }
    
    const result = await selectTopArticles(runId, 'technology', 5);
    
    expect(result.selected).toBe(5);
    expect(result.rejected).toBe(5);
    
    // Verify selected articles are marked
    const selectedResult = await turso.execute({
      sql: 'SELECT COUNT(*) as count FROM staging_articles WHERE run_id = ? AND status = ?',
      args: [runId, 'selected']
    });
    expect((selectedResult.rows[0] as any).count).toBe(5);
    
    await cleanupTestRun(runId);
  });
  
  it('should validate category counts correctly', async () => {
    const runId = await createTestRun();
    
    // Init category status
    await turso.execute({
      sql: `INSERT INTO category_status (run_id, category, target_count, current_count)
            VALUES (?, 'technology', 5, 3)`, // Short by 2
      args: [runId]
    });
    await turso.execute({
      sql: `INSERT INTO category_status (run_id, category, target_count, current_count)
            VALUES (?, 'business', 5, 5)`, // Meets target
      args: [runId]
    });
    
    const result = await validateCounts(runId);
    
    expect(result.valid).toBe(false);
    expect(result.shortCategories).toHaveLength(1);
    expect(result.shortCategories[0].category).toBe('technology');
    expect(result.shortCategories[0].current).toBe(3);
    expect(result.shortCategories[0].target).toBe(5);
    
    await cleanupTestRun(runId);
  });
  
  it('should get validation summary', async () => {
    const runId = await createTestRun();
    
    // Create test data
    await turso.execute({
      sql: `INSERT INTO category_status (run_id, category, target_count, current_count)
            VALUES (?, 'technology', 5, 5)`,
      args: [runId]
    });
    
    await createTestArticle(runId, 'technology', { url: 'https://test.com/article1' });
    await createTestArticle(runId, 'technology', { url: 'https://test.com/article2' });
    
    await turso.execute({
      sql: `UPDATE staging_articles SET status = 'selected' WHERE run_id = ? LIMIT 1`,
      args: [runId]
    });
    
    const summary = await getValidationSummary(runId);
    
    expect(summary.totalCategories).toBe(1);
    expect(summary.totalArticles).toBe(2);
    expect(summary.selectedArticles).toBe(1);
    
    await cleanupTestRun(runId);
  });
});

// =============================================================================
// PROMOTION TESTS
// =============================================================================

describe('Promotion Module', () => {
  it('should promote selected articles to live tables', async () => {
    const runId = await createTestRun();
    
    // Create and select an article
    const articleId = await createTestArticle(runId, 'technology', {
      url: 'https://test.com/promo-test',
      title: 'Promotion Test'
    });
    
    await turso.execute({
      sql: `UPDATE staging_articles SET status = 'selected' WHERE id = ?`,
      args: [articleId]
    });
    
    // Create viewpoint
    await turso.execute({
      sql: `INSERT INTO staging_viewpoints (run_id, article_id, lean, summary, sentiment_score)
            VALUES (?, ?, 'center', 'Test summary', 0.5)`,
      args: [runId, articleId]
    });
    
    const result = await promoteToLive(runId);
    
    expect(result.success).toBe(true);
    expect(result.promoted.stories).toBeGreaterThanOrEqual(1);
    
    // Verify in live table
    const liveResult = await turso.execute({
      sql: 'SELECT * FROM stories WHERE url = ?',
      args: ['https://test.com/promo-test']
    });
    
    expect(liveResult.rows.length).toBeGreaterThanOrEqual(1);
    
    // Cleanup live data
    await turso.execute({
      sql: 'DELETE FROM stories WHERE url = ?',
      args: ['https://test.com/promo-test']
    });
    
    await cleanupTestRun(runId);
  });
  
  it('should handle promotion errors gracefully', async () => {
    const runId = await createTestRun();
    
    // No selected articles - should fail pre-validation
    const result = await promoteToLive(runId);
    
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    
    await cleanupTestRun(runId);
  });
  
  it('should get promotion summary', async () => {
    const runId = await createTestRun();
    
    const articleId = await createTestArticle(runId, 'technology', {
      url: 'https://test.com/summary-test'
    });
    
    await turso.execute({
      sql: `UPDATE staging_articles SET status = 'selected' WHERE id = ?`,
      args: [articleId]
    });
    
    const summary = await getPromotionSummary(runId);
    
    expect(summary.selectedArticles).toBe(1);
    
    await cleanupTestRun(runId);
  });
});

// =============================================================================
// ORCHESTRATOR TESTS
// =============================================================================

describe('Orchestrator Module', () => {
  it('should create and track pipeline run', async () => {
    const result = await runPipeline(
      'refresh_categories',
      { categories: ['technology'], articlesPerCategory: 5 },
      'manual'
    );
    
    expect(result.runId).toBeDefined();
    expect(result.operation).toBe('refresh_categories');
    expect(result.stages.ingestion).toBeDefined();
    
    if (result.runId) {
      const status = await getPipelineStatus(result.runId);
      expect(status.run.id).toBe(result.runId);
      expect(status.run.operation).toBe('refresh_categories');
      
      await cleanupTestRun(result.runId);
    }
  });
  
  it('should handle pipeline failures gracefully', async () => {
    // Trigger with no staged articles - should fail at ingestion
    const result = await runPipeline(
      'refresh_categories',
      { categories: ['technology'] },
      'manual'
    );
    
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    
    if (result.runId) {
      await cleanupTestRun(result.runId);
    }
  });
  
  it('should chain stages in correct order', async () => {
    const result = await runPipeline(
      'full_refresh',
      { articlesPerCategory: 5 },
      'manual'
    );
    
    // Check stages executed
    expect(result.stages.ingestion).toBeDefined();
    expect(result.stages.deduplication).toBeDefined();
    expect(result.stages.validation).toBeDefined();
    expect(result.stages.promotion).toBeDefined();
    
    if (result.runId) {
      await cleanupTestRun(result.runId);
    }
  });
});

// =============================================================================
// END-TO-END INTEGRATION TEST
// =============================================================================

describe('End-to-End Pipeline', () => {
  it('should run complete pipeline with manual staging', async () => {
    const runId = await createTestRun('refresh_categories');
    
    // Init category status
    await turso.execute({
      sql: `INSERT INTO category_status (run_id, category, target_count)
            VALUES (?, 'technology', 5)`,
      args: [runId]
    });
    
    // Stage articles manually
    for (let i = 0; i < 10; i++) {
      await createTestArticle(runId, 'technology', {
        url: `https://test.com/e2e-article${i}`,
        title: `E2E Test Article ${i}`,
        published_at: new Date(Date.now() - i * 60 * 60 * 1000).toISOString()
      });
    }
    
    // Run deduplication
    const dedupResult = await deduplicateRun(runId);
    expect(dedupResult.survivingArticles).toBeGreaterThan(0);
    
    // Run validation
    const selectResult = await selectTopArticles(runId, 'technology', 5);
    expect(selectResult.selected).toBe(5);
    
    // Add viewpoints for selected articles
    const selectedArticles = await turso.execute({
      sql: 'SELECT id FROM staging_articles WHERE run_id = ? AND status = ?',
      args: [runId, 'selected']
    });
    
    for (const article of selectedArticles.rows) {
      await turso.execute({
        sql: `INSERT INTO staging_viewpoints (run_id, article_id, lean, summary, sentiment_score)
              VALUES (?, ?, 'center', 'Test summary', 0.5)`,
        args: [runId, (article as any).id]
      });
    }
    
    // Run promotion
    const promoResult = await promoteToLive(runId, ['technology']);
    expect(promoResult.success).toBe(true);
    expect(promoResult.promoted.stories).toBe(5);
    
    // Cleanup live data
    for (let i = 0; i < 10; i++) {
      await turso.execute({
        sql: 'DELETE FROM stories WHERE url = ?',
        args: [`https://test.com/e2e-article${i}`]
      });
    }
    
    await cleanupTestRun(runId);
  });
});
