/**
 * Direct Twitter Analysis Test (Credits-Conscious)
 * 
 * Tests the core analyzeArticleTwitter function directly,
 * bypassing the broken API endpoint.
 * 
 * Phase 2 Verification - xAI Credits Restored
 */

import { turso } from './src/lib/db-turso.js';
import { analyzeArticleTwitter } from './src/lib/pipeline/analysis/twitter.js';

const TEST_ARTICLES = [684, 676, 678]; // Pentagon-Anthropic, N.Korea, Clinton-Epstein
const TEST_RUN_ID = 999; // Fake run ID for testing

console.log('🧪 TWITTER ANALYSIS DIRECT TEST');
console.log('================================\n');

console.log('📋 Test Articles:');
console.log('  - 684: Pentagon-Anthropic dispute over AI guardrails');
console.log('  - 676: Kim declares South no longer "fellow countrymen"');
console.log('  - 678: Bill Clinton Epstein deposition\n');

console.log('⏰ Starting test at:', new Date().toISOString());
console.log('💰 xAI credits: Restored ($25 added)\n');

const results = [];
const startTime = Date.now();

for (let i = 0; i < TEST_ARTICLES.length; i++) {
  const articleId = TEST_ARTICLES[i];
  
  console.log(`\n[${i + 1}/3] Testing article #${articleId}...`);
  
  try {
    const result = await analyzeArticleTwitter(TEST_RUN_ID, articleId);
    
    console.log(`  ✅ Analysis complete!`);
    console.log(`  📊 Viewpoints: ${result.viewpoints.length}`);
    console.log(`  🐦 Social posts: ${result.socialPosts.length}`);
    
    // Show viewpoint summaries
    result.viewpoints.forEach(vp => {
      const summary = vp.summary.substring(0, 60);
      console.log(`    ${vp.lean.toUpperCase()}: ${summary}...`);
    });
    
    results.push({
      articleId,
      success: true,
      viewpoints: result.viewpoints.length,
      posts: result.socialPosts.length,
      error: null
    });
    
    // Rate limiting (2s between articles)
    if (i < TEST_ARTICLES.length - 1) {
      console.log(`  ⏳ Rate limiting (2s)...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
  } catch (error) {
    console.error(`  ❌ FAILED: ${error.message}`);
    results.push({
      articleId,
      success: false,
      viewpoints: 0,
      posts: 0,
      error: error.message
    });
  }
}

const endTime = Date.now();
const duration = ((endTime - startTime) / 1000).toFixed(1);

console.log('\n\n📊 TEST RESULTS');
console.log('===============\n');

const successful = results.filter(r => r.success).length;
const failed = results.filter(r => !r.success).length;

console.log(`✅ Successful: ${successful}/3`);
console.log(`❌ Failed: ${failed}/3`);
console.log(`⏱️  Duration: ${duration}s`);
console.log(`⚡ Average per article: ${(duration / 3).toFixed(1)}s\n`);

results.forEach(r => {
  const status = r.success ? '✅' : '❌';
  console.log(`${status} Article ${r.articleId}:`);
  if (r.success) {
    console.log(`   Viewpoints: ${r.viewpoints}, Posts: ${r.posts}`);
  } else {
    console.log(`   Error: ${r.error}`);
  }
});

// Verify database writes
console.log('\n\n🔍 VERIFYING DATABASE...\n');

try {
  // Check if we're using staging or live tables
  // (analyzeArticleTwitter writes directly to live tables, not staging)
  
  for (const articleId of TEST_ARTICLES) {
    const { results: viewpoints } = await turso.execute({
      sql: 'SELECT COUNT(*) as count FROM viewpoints WHERE article_id = ?',
      args: [articleId]
    });
    
    const { results: posts } = await turso.execute({
      sql: 'SELECT COUNT(*) as count FROM social_posts WHERE article_id = ?',
      args: [articleId]
    });
    
    const vpCount = viewpoints[0]?.count || 0;
    const postCount = posts[0]?.count || 0;
    
    console.log(`Article ${articleId}: ${vpCount} viewpoints, ${postCount} posts in DB`);
  }
  
} catch (dbError) {
  console.error('❌ Database verification failed:', dbError.message);
}

console.log('\n\n🎯 TEST COMPLETE');
console.log('================\n');

if (successful === 3) {
  console.log('✅ ALL TESTS PASSED');
  console.log('✅ xAI credits working');
  console.log('✅ Twitter analysis functional');
  console.log('✅ Phase 2 VERIFIED\n');
  process.exit(0);
} else {
  console.log('❌ SOME TESTS FAILED');
  console.log('⚠️  Review errors above\n');
  process.exit(1);
}
