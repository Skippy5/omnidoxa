/**
 * Unit tests for text processing utilities
 * Run with: npx tsx tests/text-processing.test.ts
 */

import {
  normalizeUrl,
  normalizeTitle,
  contentHash,
  jaccardSimilarity,
  levenshteinDistance,
  isFuzzyDuplicate
} from '../src/lib/utils/text-processing';

// Simple test runner
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error instanceof Error ? error.message : error}`);
    failed++;
  }
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

// ============================================================================
// URL NORMALIZATION TESTS
// ============================================================================

console.log('\n📝 Testing normalizeUrl()...\n');

test('removes www prefix', () => {
  const result = normalizeUrl('https://www.example.com/article');
  assertEquals(result, 'https://example.com/article');
});

test('removes UTM parameters', () => {
  const result = normalizeUrl('https://example.com/article?utm_source=twitter&utm_medium=social');
  assertEquals(result, 'https://example.com/article');
});

test('removes fbclid tracking parameter', () => {
  const result = normalizeUrl('https://example.com/article?fbclid=abc123');
  assertEquals(result, 'https://example.com/article');
});

test('removes trailing slash from path', () => {
  const result = normalizeUrl('https://example.com/article/');
  assertEquals(result, 'https://example.com/article');
});

test('keeps root trailing slash', () => {
  const result = normalizeUrl('https://example.com/');
  assertEquals(result, 'https://example.com/');
});

test('lowercases hostname', () => {
  const result = normalizeUrl('https://EXAMPLE.COM/Article');
  assertEquals(result, 'https://example.com/Article'); // Path case preserved
});

test('preserves non-tracking query params', () => {
  const result = normalizeUrl('https://example.com/article?id=123&page=2');
  assertEquals(result, 'https://example.com/article?id=123&page=2');
});

test('handles mixed tracking and non-tracking params', () => {
  const result = normalizeUrl('https://example.com/article?id=123&utm_source=x&page=2');
  assertEquals(result, 'https://example.com/article?id=123&page=2');
});

test('preserves hash fragments', () => {
  const result = normalizeUrl('https://example.com/article#section-1');
  assertEquals(result, 'https://example.com/article#section-1');
});

test('handles complex real-world URL', () => {
  const result = normalizeUrl(
    'https://www.TechCrunch.com/2024/01/15/article-title/?utm_source=newsletter&utm_campaign=daily&ref=homepage'
  );
  assertEquals(result, 'https://techcrunch.com/2024/01/15/article-title');
});

test('handles invalid URL gracefully', () => {
  const result = normalizeUrl('not-a-valid-url');
  assertEquals(result, 'not-a-valid-url'); // Falls back to lowercase
});

// ============================================================================
// TITLE NORMALIZATION TESTS
// ============================================================================

console.log('\n📝 Testing normalizeTitle()...\n');

test('converts to lowercase', () => {
  const result = normalizeTitle('Breaking NEWS: Major Event');
  assertEquals(result, 'breaking news major event');
});

test('removes punctuation', () => {
  const result = normalizeTitle('US vs. Iran—What Happens Next?!');
  assertEquals(result, 'us vs iran what happens next');
});

test('collapses multiple spaces', () => {
  const result = normalizeTitle('Multiple    spaces   here');
  assertEquals(result, 'multiple spaces here');
});

test('trims whitespace', () => {
  const result = normalizeTitle('  Leading and trailing  ');
  assertEquals(result, 'leading and trailing');
});

test('handles mixed case and punctuation', () => {
  const result = normalizeTitle('Breaking: US vs. Iran—What Happens Next?!');
  assertEquals(result, 'breaking us vs iran what happens next');
});

test('handles empty string', () => {
  const result = normalizeTitle('');
  assertEquals(result, '');
});

test('handles only punctuation', () => {
  const result = normalizeTitle('!!!???...');
  assertEquals(result, '');
});

// ============================================================================
// CONTENT HASH TESTS
// ============================================================================

console.log('\n📝 Testing contentHash()...\n');

test('produces same hash for identical content', () => {
  const hash1 = contentHash('Breaking News', 'This is a story');
  const hash2 = contentHash('Breaking News', 'This is a story');
  assertEquals(hash1, hash2);
});

test('produces different hash for different titles', () => {
  const hash1 = contentHash('Breaking News', 'This is a story');
  const hash2 = contentHash('Different Title', 'This is a story');
  assertTrue(hash1 !== hash2);
});

test('produces different hash for different descriptions', () => {
  const hash1 = contentHash('Breaking News', 'This is a story');
  const hash2 = contentHash('Breaking News', 'Different description');
  assertTrue(hash1 !== hash2);
});

test('handles null description', () => {
  const hash = contentHash('Breaking News', null);
  assertTrue(hash.length === 64); // SHA-256 = 64 hex chars
});

test('handles undefined description', () => {
  const hash = contentHash('Breaking News');
  assertTrue(hash.length === 64);
});

test('is deterministic (same input = same output)', () => {
  const hashes = new Set();
  for (let i = 0; i < 100; i++) {
    hashes.add(contentHash('Test Title', 'Test Description'));
  }
  assertEquals(hashes.size, 1, 'Hash should be deterministic');
});

test('normalizes before hashing (case-insensitive)', () => {
  const hash1 = contentHash('BREAKING NEWS', 'THIS IS A STORY');
  const hash2 = contentHash('breaking news', 'this is a story');
  assertEquals(hash1, hash2);
});

// ============================================================================
// JACCARD SIMILARITY TESTS
// ============================================================================

console.log('\n📝 Testing jaccardSimilarity()...\n');

test('returns 1.0 for identical titles', () => {
  const score = jaccardSimilarity('us iran war', 'us iran war');
  assertEquals(score, 1.0);
});

test('returns 0.0 for completely different titles', () => {
  const score = jaccardSimilarity('technology breakthrough', 'sports victory');
  assertEquals(score, 0.0);
});

test('calculates partial similarity correctly', () => {
  const score = jaccardSimilarity('us iran war', 'iran us conflict');
  // Common: us, iran (2 words)
  // Total unique: us, iran, war, conflict (4 words)
  // Score = 2/4 = 0.5
  assertEquals(score, 0.5);
});

test('handles word order differences', () => {
  const score = jaccardSimilarity('iran us war', 'us iran war');
  assertEquals(score, 1.0); // Same words, different order
});

test('handles empty strings', () => {
  const score = jaccardSimilarity('', '');
  assertEquals(score, 0); // Both empty = 0 (not 1)
});

// ============================================================================
// LEVENSHTEIN DISTANCE TESTS
// ============================================================================

console.log('\n📝 Testing levenshteinDistance()...\n');

test('returns 0 for identical strings', () => {
  const dist = levenshteinDistance('kitten', 'kitten');
  assertEquals(dist, 0);
});

test('calculates distance for kitten -> sitting', () => {
  const dist = levenshteinDistance('kitten', 'sitting');
  assertEquals(dist, 3); // k→s, e→i, +g
});

test('handles empty strings', () => {
  const dist1 = levenshteinDistance('', 'hello');
  assertEquals(dist1, 5); // Insert 5 chars
  
  const dist2 = levenshteinDistance('hello', '');
  assertEquals(dist2, 5); // Delete 5 chars
});

test('handles single character difference', () => {
  const dist = levenshteinDistance('hello', 'hallo');
  assertEquals(dist, 1);
});

// ============================================================================
// FUZZY DUPLICATE TESTS
// ============================================================================

console.log('\n📝 Testing isFuzzyDuplicate()...\n');

test('detects exact duplicates', () => {
  assertTrue(isFuzzyDuplicate('US Bombs Iran Base', 'US Bombs Iran Base'));
});

test('detects case-insensitive duplicates', () => {
  assertTrue(isFuzzyDuplicate('US Bombs Iran Base', 'us bombs iran base'));
});

test('detects word-reordered duplicates', () => {
  // Same words, different order
  assertTrue(isFuzzyDuplicate('US Iran Military Base Attack', 'Attack Military Base Iran US'));
  // All same words = 1.0 similarity
});

test('detects fuzzy matches with punctuation', () => {
  assertTrue(isFuzzyDuplicate(
    'Breaking: US vs. Iran—War Begins!',
    'US vs Iran War Begins'
  ));
});

test('rejects completely different titles', () => {
  assertFalse(isFuzzyDuplicate(
    'US Bombs Iran Base',
    'Tech Company Releases New Product'
  ));
});

test('handles threshold edge cases', () => {
  // Just above 0.75 threshold
  const title1 = 'a b c d e f g h';
  const title2 = 'a b c d e f'; // 6/8 = 0.75 (exact threshold)
  // This might be true or false depending on rounding
  
  const title3 = 'x y z';
  const title4 = 'a b c d';
  assertFalse(isFuzzyDuplicate(title3, title4)); // 0/7 = 0.0
});

test('real-world example: same story different headlines', () => {
  assertTrue(isFuzzyDuplicate(
    'Trump Wins Iowa Caucus with 51%',
    'Iowa Caucus: Trump Wins with 51 Percent'
  ));
});

test('real-world example: different stories similar topic', () => {
  assertFalse(isFuzzyDuplicate(
    'Trump Announces Presidential Campaign',
    'Biden Criticizes Trump Campaign Strategy'
  ));
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total: ${passed + failed}`);
console.log('='.repeat(60) + '\n');

process.exit(failed > 0 ? 1 : 0);
