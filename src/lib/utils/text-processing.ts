import { createHash } from 'crypto';

/**
 * Normalize a URL for deduplication purposes
 * - Strips UTM parameters and other tracking codes
 * - Removes www. prefix
 * - Removes trailing slashes
 * - Lowercases the hostname
 * 
 * @param url - The URL to normalize
 * @returns Normalized URL string
 * 
 * @example
 * normalizeUrl('https://www.example.com/article?utm_source=twitter')
 * // Returns: 'https://example.com/article'
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Lowercase the hostname and remove www. prefix
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    
    // Remove tracking parameters (UTM, fbclid, etc.)
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid',
      '_ga', '_gl', 'ref', 'referrer'
    ];
    
    trackingParams.forEach(param => {
      parsed.searchParams.delete(param);
    });
    
    // Get pathname (preserve case for path)
    let pathname = parsed.pathname;
    
    // Remove trailing slash from pathname (unless it's the root "/")
    if (pathname.endsWith('/') && pathname !== '/') {
      pathname = pathname.slice(0, -1);
    }
    
    // Rebuild URL with protocol
    let normalized = `${parsed.protocol}//${hostname}${pathname}`;
    
    // Add back query string if any params remain
    const queryString = parsed.searchParams.toString();
    if (queryString) {
      normalized += `?${queryString}`;
    }
    
    // Add back hash if present
    if (parsed.hash) {
      normalized += parsed.hash;
    }
    
    return normalized;
  } catch (error) {
    // If URL parsing fails, return the original (better than crashing)
    console.warn(`Failed to normalize URL: ${url}`, error);
    return url.toLowerCase().trim();
  }
}

/**
 * Normalize a title for fuzzy matching
 * - Converts to lowercase
 * - Removes punctuation
 * - Collapses multiple whitespace into single space
 * - Trims leading/trailing whitespace
 * 
 * @param title - The title to normalize
 * @returns Normalized title string
 * 
 * @example
 * normalizeTitle('Breaking: US vs. Iran—What Happens Next?!')
 * // Returns: 'breaking us vs iran what happens next'
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    // Replace punctuation with spaces (preserves word boundaries)
    .replace(/[^\w\s]/g, ' ')
    // Collapse multiple whitespace into single space
    .replace(/\s+/g, ' ')
    // Trim
    .trim();
}

/**
 * Generate a SHA-256 hash from title and description for content deduplication
 * - Normalizes both inputs before hashing
 * - Returns deterministic hash for identical content
 * 
 * @param title - Article title
 * @param description - Article description (optional)
 * @returns SHA-256 hash (hex string)
 * 
 * @example
 * contentHash('Breaking News', 'This is a story')
 * // Returns: 'a3f2b8c1...' (64-char hex string)
 */
export function contentHash(title: string, description?: string | null): string {
  // Normalize inputs
  const normalizedTitle = normalizeTitle(title);
  const normalizedDesc = description ? normalizeTitle(description) : '';
  
  // Combine and hash
  const combined = `${normalizedTitle}|${normalizedDesc}`;
  const hash = createHash('sha256');
  hash.update(combined);
  
  return hash.digest('hex');
}

/**
 * Calculate Jaccard similarity between two normalized titles
 * Used for fuzzy matching in deduplication layer 3
 * 
 * @param title1 - First normalized title
 * @param title2 - Second normalized title
 * @returns Similarity score (0.0 to 1.0)
 * 
 * @example
 * jaccardSimilarity('us iran war begins', 'iran us war started')
 * // Returns: ~0.6 (4 common words / 6 total unique words)
 */
export function jaccardSimilarity(title1: string, title2: string): number {
  const words1 = new Set(title1.split(/\s+/).filter(w => w.length > 0));
  const words2 = new Set(title2.split(/\s+/).filter(w => w.length > 0));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  if (union.size === 0) return 0;
  
  return intersection.size / union.size;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for character-level fuzzy matching
 * 
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance (lower = more similar)
 * 
 * @example
 * levenshteinDistance('kitten', 'sitting')
 * // Returns: 3
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Create 2D array
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));
  
  // Initialize base cases
  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;
  
  // Fill DP table
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // deletion
          dp[i][j - 1] + 1,      // insertion
          dp[i - 1][j - 1] + 1   // substitution
        );
      }
    }
  }
  
  return dp[len1][len2];
}

/**
 * Check if two titles are fuzzy duplicates using Jaccard similarity
 * Threshold: 0.75 (75% word overlap)
 * 
 * @param title1 - First title (raw)
 * @param title2 - Second title (raw)
 * @returns true if titles are likely duplicates
 * 
 * @example
 * isFuzzyDuplicate('US Bombs Iran Base', 'Iran Base Bombed by US')
 * // Returns: true
 */
export function isFuzzyDuplicate(title1: string, title2: string): boolean {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);
  
  // Quick exact match check
  if (norm1 === norm2) return true;
  
  // Jaccard similarity check
  const similarity = jaccardSimilarity(norm1, norm2);
  
  return similarity >= 0.75;
}
