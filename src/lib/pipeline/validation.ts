/**
 * OmniDoxa Pipeline - Validation & Repull Module
 * 
 * Functions:
 * - selectTopArticles: Ranks and selects top N articles per category
 * - validateCounts: Checks each category meets target count
 * - repullShortCategories: Fetches more articles for categories below target
 * 
 * Phase: 1.10 - Validation + Repull Module
 * Created: 2026-02-28
 */

import { turso } from '../db-turso';
import type { Category } from '../types';

/**
 * Ranking criteria for article selection
 */
function calculateArticleScore(article: any): number {
  let score = 0;
  
  // Recency: newer = higher score (max 100 points)
  const publishedAt = new Date(article.published_at || 0);
  const now = new Date();
  const ageHours = (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60);
  const recencyScore = Math.max(0, 100 - ageHours); // Decreases by 1 point per hour
  score += recencyScore;
  
  // Source quality: favor trusted sources (max 50 points)
  const trustedSources = ['reuters', 'ap', 'bbc', 'npr', 'wsj', 'nytimes', 'cnn', 'fox'];
  const source = (article.source || '').toLowerCase();
  if (trustedSources.some(s => source.includes(s))) {
    score += 50;
  } else {
    score += 20; // Default score for other sources
  }
  
  // Content length: favor articles with descriptions (max 30 points)
  const descLength = (article.description || '').length;
  score += Math.min(30, descLength / 10);
  
  return score;
}

/**
 * Select top N articles from deduplicated pool for a category
 * Marks top N as 'selected', remainder as 'rejected' with reason 'surplus'
 */
export async function selectTopArticles(
  runId: number,
  category: Category,
  targetCount: number
): Promise<{ selected: number; rejected: number }> {
  console.log(`[Validation] Selecting top ${targetCount} articles for ${category}...`);
  
  // Fetch deduplicated articles for this category
  const articlesResult = await turso.execute({
    sql: `SELECT * FROM staging_articles 
          WHERE run_id = ? AND category = ? AND status = 'staged'
          ORDER BY published_at DESC`,
    args: [runId, category]
  });
  
  const articles = articlesResult.rows as any[];
  console.log(`[Validation] Found ${articles.length} deduplicated articles for ${category}`);
  
  if (articles.length === 0) {
    return { selected: 0, rejected: 0 };
  }
  
  // Rank articles
  const ranked = articles.map(article => ({
    ...article,
    score: calculateArticleScore(article)
  })).sort((a, b) => b.score - a.score);
  
  // Select top N
  const toSelect = ranked.slice(0, targetCount);
  const toReject = ranked.slice(targetCount);
  
  // Update selected articles
  if (toSelect.length > 0) {
    const selectIds = toSelect.map(a => a.id);
    const chunks = [];
    for (let i = 0; i < selectIds.length; i += 50) {
      chunks.push(selectIds.slice(i, i + 50));
    }
    
    for (const chunk of chunks) {
      const placeholders = chunk.map(() => '?').join(',');
      await turso.execute({
        sql: `UPDATE staging_articles SET status = 'selected' WHERE id IN (${placeholders})`,
        args: chunk
      });
    }
  }
  
  // Update rejected articles (surplus)
  if (toReject.length > 0) {
    const rejectIds = toReject.map(a => a.id);
    const chunks = [];
    for (let i = 0; i < rejectIds.length; i += 50) {
      chunks.push(rejectIds.slice(i, i + 50));
    }
    
    for (const chunk of chunks) {
      const placeholders = chunk.map(() => '?').join(',');
      await turso.execute({
        sql: `UPDATE staging_articles 
              SET status = 'rejected', rejection_reason = 'surplus' 
              WHERE id IN (${placeholders})`,
        args: chunk
      });
    }
  }
  
  console.log(`[Validation] Selected ${toSelect.length}, rejected ${toReject.length} (surplus)`);
  
  // Update category_status
  await turso.execute({
    sql: `UPDATE category_status 
          SET current_count = ?, status = 'ready', updated_at = datetime('now') 
          WHERE run_id = ? AND category = ?`,
    args: [toSelect.length, runId, category]
  });
  
  return {
    selected: toSelect.length,
    rejected: toReject.length
  };
}

/**
 * Validate that all categories meet their target counts
 */
export async function validateCounts(runId: number): Promise<{
  valid: boolean;
  shortCategories: Array<{ category: Category; current: number; target: number }>;
}> {
  console.log(`[Validation] Validating article counts for run ${runId}...`);
  
  const result = await turso.execute({
    sql: `SELECT category, current_count, target_count 
          FROM category_status 
          WHERE run_id = ?`,
    args: [runId]
  });
  
  const categories = result.rows as any[];
  const shortCategories: Array<{ category: Category; current: number; target: number }> = [];
  
  for (const cat of categories) {
    if (cat.current_count < cat.target_count) {
      shortCategories.push({
        category: cat.category as Category,
        current: cat.current_count as number,
        target: cat.target_count as number
      });
    }
  }
  
  const valid = shortCategories.length === 0;
  
  if (valid) {
    console.log(`[Validation] ✅ All categories meet target counts`);
  } else {
    console.log(`[Validation] ⚠️ ${shortCategories.length} categories below target:`, shortCategories);
  }
  
  return { valid, shortCategories };
}

/**
 * Repull articles for categories that are short of target count
 * This is a stub - actual implementation requires ingestion module
 */
export async function repullShortCategories(
  runId: number,
  maxAttempts: number = 3
): Promise<{
  repulled: Array<{ category: Category; fetchedCount: number; newTotal: number }>;
  failedCategories: Category[];
}> {
  console.log(`[Validation] Checking for short categories (max attempts: ${maxAttempts})...`);
  
  const { shortCategories } = await validateCounts(runId);
  
  if (shortCategories.length === 0) {
    console.log(`[Validation] No short categories to repull`);
    return { repulled: [], failedCategories: [] };
  }
  
  const repulled: Array<{ category: Category; fetchedCount: number; newTotal: number }> = [];
  const failedCategories: Category[] = [];
  
  for (const { category, current, target } of shortCategories) {
    // Check current attempt count
    const statusResult = await turso.execute({
      sql: 'SELECT pull_attempts FROM category_status WHERE run_id = ? AND category = ?',
      args: [runId, category]
    });
    
    const pullAttempts = (statusResult.rows[0]?.pull_attempts as number) || 0;
    
    if (pullAttempts >= maxAttempts) {
      console.log(`[Validation] ⚠️ ${category} reached max attempts (${pullAttempts}), skipping repull`);
      failedCategories.push(category);
      continue;
    }
    
    console.log(`[Validation] Repull needed for ${category}: ${current}/${target} (attempt ${pullAttempts + 1}/${maxAttempts})`);
    
    // Increment pull attempts
    await turso.execute({
      sql: `UPDATE category_status 
            SET pull_attempts = pull_attempts + 1, status = 'fetching', updated_at = datetime('now') 
            WHERE run_id = ? AND category = ?`,
      args: [runId, category]
    });
    
    // NOTE: Actual repull logic would call ingestion module here
    // For now, we just update the status
    // TODO: Integrate with ingestion/category-refresh.ts when implemented
    
    console.log(`[Validation] ⚠️ Repull logic not yet implemented - would fetch ${target - current} more articles for ${category}`);
    
    // Placeholder: mark as failed for now
    failedCategories.push(category);
  }
  
  return { repulled, failedCategories };
}

/**
 * Get validation summary for a run
 */
export async function getValidationSummary(runId: number): Promise<{
  totalCategories: number;
  readyCategories: number;
  shortCategories: number;
  totalArticles: number;
  selectedArticles: number;
  rejectedArticles: number;
}> {
  const [categoriesResult, articlesResult] = await Promise.all([
    turso.execute({
      sql: `SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN current_count >= target_count THEN 1 ELSE 0 END) as ready,
              SUM(CASE WHEN current_count < target_count THEN 1 ELSE 0 END) as short
            FROM category_status 
            WHERE run_id = ?`,
      args: [runId]
    }),
    turso.execute({
      sql: `SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN status = 'selected' THEN 1 ELSE 0 END) as selected,
              SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
            FROM staging_articles 
            WHERE run_id = ?`,
      args: [runId]
    })
  ]);
  
  const catStats = categoriesResult.rows[0] as any;
  const artStats = articlesResult.rows[0] as any;
  
  return {
    totalCategories: catStats.total || 0,
    readyCategories: catStats.ready || 0,
    shortCategories: catStats.short || 0,
    totalArticles: artStats.total || 0,
    selectedArticles: artStats.selected || 0,
    rejectedArticles: artStats.rejected || 0
  };
}
