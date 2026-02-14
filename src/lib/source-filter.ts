/**
 * Source Quality Filter
 * Filters out tabloid and low-quality sources
 */

// Tier 1: Highly trusted news sources
export const TIER1_SOURCES = new Set([
  'reuters', 'associated press', 'ap news', 'bbc', 'npr', 'pbs',
  'the economist', 'financial times', 'wall street journal', 'wsj',
  'new york times', 'washington post', 'los angeles times',
  'the guardian', 'bloomberg', 'politico', 'axios', 'the hill',
  'cnn', 'msnbc', 'fox news', 'abc news', 'cbs news', 'nbc news'
]);

// Tier 2: Reputable regional and specialty sources
export const TIER2_SOURCES = new Set([
  'usa today', 'chicago tribune', 'boston globe', 'atlanta journal',
  'houston chronicle', 'dallas morning news', 'san francisco chronicle',
  'seattle times', 'denver post', 'miami herald', 'philadelphia inquirer',
  'techcrunch', 'wired', 'the verge', 'ars technica', 'engadget',
  'forbes', 'business insider', 'cnbc', 'marketwatch',
  'nature', 'science', 'scientific american', 'new scientist',
  'espn', 'sports illustrated', 'bleacher report',
  'variety', 'hollywood reporter', 'deadline', 'entertainment weekly'
]);

// Blocked sources (tabloids, clickbait, propaganda)
export const BLOCKED_SOURCES = new Set([
  'daily mail', 'the sun', 'daily express', 'daily star',
  'national enquirer', 'us weekly', 'star magazine', 'ok magazine',
  'tmz', 'radar online', 'perez hilton',
  'breitbart', 'infowars', 'natural news', 'the gateway pundit',
  'occupy democrats', 'bipartisan report', 'addicting info',
  'newsmax'
]);

export type SourceTier = 'tier1' | 'tier2' | 'acceptable' | 'blocked' | 'unknown';

export function classifySource(sourceName: string): SourceTier {
  const normalized = sourceName.toLowerCase().trim();
  
  if (BLOCKED_SOURCES.has(normalized)) return 'blocked';
  if (TIER1_SOURCES.has(normalized)) return 'tier1';
  if (TIER2_SOURCES.has(normalized)) return 'tier2';
  
  // Check partial matches for blocked sources
  for (const blocked of BLOCKED_SOURCES) {
    if (normalized.includes(blocked) || blocked.includes(normalized)) {
      return 'blocked';
    }
  }
  
  return 'unknown'; // Allow unknown sources (may be legitimate regional news)
}

export function isSourceAllowed(sourceName: string): boolean {
  const tier = classifySource(sourceName);
  return tier !== 'blocked';
}

/**
 * Filter articles by source quality
 */
export function filterBySourceQuality<T extends { source_name?: string; source?: string }>(
  articles: T[],
  options: {
    minTier?: SourceTier;
    logFiltered?: boolean;
  } = {}
): T[] {
  const { minTier, logFiltered = true } = options;
  
  return articles.filter(article => {
    const source = article.source_name || article.source || '';
    const tier = classifySource(source);
    
    if (tier === 'blocked') {
      if (logFiltered) {
        console.log(`  🚫 Filtered out: "${source}" (blocked source)`);
      }
      return false;
    }
    
    // If minTier specified, filter by tier
    if (minTier) {
      const tierOrder = ['tier1', 'tier2', 'acceptable', 'unknown'];
      const articleTierIndex = tierOrder.indexOf(tier);
      const minTierIndex = tierOrder.indexOf(minTier);
      
      if (articleTierIndex > minTierIndex) {
        if (logFiltered) {
          console.log(`  ⚠️ Filtered out: "${source}" (below minimum tier)`);
        }
        return false;
      }
    }
    
    return true;
  });
}
