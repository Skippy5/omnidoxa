/**
 * OmniDoxa Pipeline - Deduplication Module
 * 
 * 4-Layer Deduplication Strategy:
 * 1. Exact URL matching (O(n) with hash map)
 * 2. Content hash matching (O(n))
 * 3. Fuzzy title matching (only on remaining ~50 articles after layers 1-2)
 * 4. Cross-category dedup (check against other categories in same run)
 * 
 * Performance: Must complete in <10s for 500 articles
 * 
 * Phase: 1.9 - Deduplication Module
 * Created: 2026-02-28
 */

import { turso } from '../db-turso';
import crypto from 'crypto';

/**
 * Text processing utilities
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove UTM params, trailing slash, fragments
    parsed.search = '';
    parsed.hash = '';
    let normalized = parsed.toString().toLowerCase();
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return url.toLowerCase().trim();
  }
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')     // Collapse whitespace
    .trim();
}

function contentHash(title: string, description: string | null): string {
  const content = `${title}|${description || ''}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Jaccard similarity for fuzzy title matching
 */
function jaccardSimilarity(title1: string, title2: string): number {
  const words1 = new Set(title1.split(' '));
  const words2 = new Set(title2.split(' '));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Levenshtein distance (edit distance)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Fuzzy title matching using Jaccard + Levenshtein
 */
function areTitlesSimilar(title1: string, title2: string): boolean {
  const normalized1 = normalizeTitle(title1);
  const normalized2 = normalizeTitle(title2);
  
  // Quick check: exact match after normalization
  if (normalized1 === normalized2) return true;
  
  // Jaccard similarity threshold
  const jaccard = jaccardSimilarity(normalized1, normalized2);
  if (jaccard > 0.75) return true;
  
  // Levenshtein distance (normalized by max length)
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLen = Math.max(normalized1.length, normalized2.length);
  const similarity = 1 - (distance / maxLen);
  
  return similarity > 0.80;
}

/**
 * Main deduplication function
 * Runs 4-layer dedup on all staged articles for a given run
 */
export async function deduplicateRun(runId: number): Promise<{
  totalArticles: number;
  duplicatesFound: number;
  survivingArticles: number;
  layerStats: {
    layer1_url: number;
    layer2_hash: number;
    layer3_fuzzy: number;
    layer4_cross_category: number;
  };
}> {
  console.log(`[Dedup] Starting deduplication for run ${runId}...`);
  const startTime = Date.now();
  
  // Fetch all staged articles for this run
  const articlesResult = await turso.execute({
    sql: 'SELECT * FROM staging_articles WHERE run_id = ? AND status = ?',
    args: [runId, 'staged']
  });
  
  const articles = articlesResult.rows as any[];
  const totalArticles = articles.length;
  
  console.log(`[Dedup] Found ${totalArticles} staged articles`);
  
  if (totalArticles === 0) {
    return {
      totalArticles: 0,
      duplicatesFound: 0,
      survivingArticles: 0,
      layerStats: { layer1_url: 0, layer2_hash: 0, layer3_fuzzy: 0, layer4_cross_category: 0 }
    };
  }
  
  // Track duplicates by layer
  const layerStats = {
    layer1_url: 0,
    layer2_hash: 0,
    layer3_fuzzy: 0,
    layer4_cross_category: 0
  };
  
  const duplicateIds: number[] = [];
  const seenUrls = new Map<string, number>(); // url -> article id
  const seenHashes = new Map<string, number>(); // hash -> article id
  
  // LAYER 1: Exact URL dedup (O(n))
  console.log('[Dedup] Layer 1: URL deduplication...');
  for (const article of articles) {
    const normalized = article.url_normalized as string;
    if (seenUrls.has(normalized)) {
      duplicateIds.push(article.id as number);
      layerStats.layer1_url++;
    } else {
      seenUrls.set(normalized, article.id as number);
    }
  }
  
  // LAYER 2: Content hash dedup (O(n))
  console.log('[Dedup] Layer 2: Content hash deduplication...');
  const survivingAfterLayer1 = articles.filter(a => !duplicateIds.includes(a.id as number));
  
  for (const article of survivingAfterLayer1) {
    const hash = article.content_hash as string;
    if (seenHashes.has(hash)) {
      duplicateIds.push(article.id as number);
      layerStats.layer2_hash++;
    } else {
      seenHashes.set(hash, article.id as number);
    }
  }
  
  // LAYER 3: Fuzzy title matching (only on remaining articles)
  console.log('[Dedup] Layer 3: Fuzzy title matching...');
  const survivingAfterLayer2 = articles.filter(a => !duplicateIds.includes(a.id as number));
  
  for (let i = 0; i < survivingAfterLayer2.length; i++) {
    const article1 = survivingAfterLayer2[i];
    if (duplicateIds.includes(article1.id as number)) continue;
    
    for (let j = i + 1; j < survivingAfterLayer2.length; j++) {
      const article2 = survivingAfterLayer2[j];
      if (duplicateIds.includes(article2.id as number)) continue;
      
      if (areTitlesSimilar(article1.title as string, article2.title as string)) {
        // Keep the one with earlier publication date (or lower ID as tiebreaker)
        const article1Date = new Date(article1.published_at as string || 0);
        const article2Date = new Date(article2.published_at as string || 0);
        
        if (article2Date < article1Date || (article2Date.getTime() === article1Date.getTime() && (article2.id as number) < (article1.id as number))) {
          duplicateIds.push(article1.id as number);
          layerStats.layer3_fuzzy++;
          break;
        } else {
          duplicateIds.push(article2.id as number);
          layerStats.layer3_fuzzy++;
        }
      }
    }
  }
  
  // LAYER 4: Cross-category dedup (check against other categories in same run)
  console.log('[Dedup] Layer 4: Cross-category deduplication...');
  const survivingAfterLayer3 = articles.filter(a => !duplicateIds.includes(a.id as number));
  
  // Group by category
  const byCategory = new Map<string, any[]>();
  for (const article of survivingAfterLayer3) {
    const cat = article.category as string;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(article);
  }
  
  // Check each category against others
  const categories = Array.from(byCategory.keys());
  for (let i = 0; i < categories.length; i++) {
    for (let j = i + 1; j < categories.length; j++) {
      const cat1Articles = byCategory.get(categories[i])!;
      const cat2Articles = byCategory.get(categories[j])!;
      
      for (const article1 of cat1Articles) {
        if (duplicateIds.includes(article1.id as number)) continue;
        
        for (const article2 of cat2Articles) {
          if (duplicateIds.includes(article2.id as number)) continue;
          
          // Check URL or hash match across categories
          if (article1.url_normalized === article2.url_normalized || article1.content_hash === article2.content_hash) {
            // Keep in the "higher priority" category (or earlier alphabetically)
            if (categories[i] < categories[j]) {
              duplicateIds.push(article2.id as number);
            } else {
              duplicateIds.push(article1.id as number);
            }
            layerStats.layer4_cross_category++;
          }
        }
      }
    }
  }
  
  // Mark duplicates in database
  if (duplicateIds.length > 0) {
    console.log(`[Dedup] Marking ${duplicateIds.length} duplicates as rejected...`);
    
    const chunks = [];
    for (let i = 0; i < duplicateIds.length; i += 50) {
      chunks.push(duplicateIds.slice(i, i + 50));
    }
    
    for (const chunk of chunks) {
      const placeholders = chunk.map(() => '?').join(',');
      await turso.execute({
        sql: `UPDATE staging_articles 
              SET status = 'rejected', rejection_reason = 'duplicate' 
              WHERE id IN (${placeholders})`,
        args: chunk
      });
    }
  }
  
  // Mark survivors as deduplicated
  console.log(`[Dedup] Marking ${articles.length - duplicateIds.length} survivors as deduplicated...`);
  await turso.execute({
    sql: `UPDATE staging_articles 
          SET status = 'deduplicated' 
          WHERE run_id = ? AND status = 'staged'`,
    args: [runId]
  });
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const survivingArticles = totalArticles - duplicateIds.length;
  
  console.log(`[Dedup] Complete in ${duration}s`);
  console.log(`[Dedup] Total: ${totalArticles} | Duplicates: ${duplicateIds.length} | Surviving: ${survivingArticles}`);
  console.log(`[Dedup] Layer stats:`, layerStats);
  
  return {
    totalArticles,
    duplicatesFound: duplicateIds.length,
    survivingArticles,
    layerStats
  };
}
