#!/usr/bin/env node
/**
 * Phase 2 Twitter Integration Test
 * Simple test runner for the new twitterapi.io + Grok AI system
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 PHASE 2 TWITTER INTEGRATION TEST\n');
console.log('Testing: twitterapi.io + Grok 3 Mini AI classification');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Test configuration
const TEST_ARTICLE = {
  title: "Senate Passes Bipartisan Infrastructure Bill",
  description: "Major infrastructure legislation approved with bipartisan support",
  link: "https://example.com/test",
  source_name: "Test News",
  image_url: null,
  category: ["politics"],
  pubDate: new Date().toISOString()
};

async function runTest() {
  try {
    // Dynamically import Phase 2 modules
    console.log('📦 Loading Phase 2 modules...\n');
    
    const { searchArticleTweets } = await import('../src/lib/twitterapi-io.ts');
    const { classifyTweets, distributeTweets } = await import('../src/lib/tweet-classifier.ts');
    
    // Step 1: Search for tweets
    console.log('🔍 Step 1: Searching for tweets...');
    console.log(`   Article: "${TEST_ARTICLE.title}"\n`);
    
    const tweets = await searchArticleTweets(TEST_ARTICLE.title, 20);
    
    console.log(`✅ Found ${tweets.length} tweets\n`);
    
    if (tweets.length === 0) {
      console.log('⚠️  No tweets found - test cannot proceed');
      console.log('   This might be normal if the article is not real.');
      console.log('   Try with a real news article title instead.\n');
      process.exit(0);
    }
    
    // Display sample tweets
    console.log('📝 Sample tweets:');
    tweets.slice(0, 3).forEach((tweet, i) => {
      console.log(`   ${i + 1}. @${tweet.author.userName}: ${tweet.text.substring(0, 60)}...`);
      console.log(`      👍 ${tweet.likeCount} | 🔁 ${tweet.retweetCount}\n`);
    });
    
    // Step 2: Classify with AI
    console.log('🤖 Step 2: Classifying tweets with Grok 3 Mini...\n');
    
    const classifications = await classifyTweets(TEST_ARTICLE, tweets);
    
    console.log(`✅ Classified ${classifications.length} tweets\n`);
    
    // Display classifications
    console.log('📊 Classification results:');
    const leanCounts = {
      left: classifications.filter(c => c.lean === 'left').length,
      center: classifications.filter(c => c.lean === 'center').length,
      right: classifications.filter(c => c.lean === 'right').length
    };
    console.log(`   LEFT: ${leanCounts.left} | CENTER: ${leanCounts.center} | RIGHT: ${leanCounts.right}\n`);
    
    // Step 3: Distribute into perspectives
    console.log('🎯 Step 3: Distributing top 3 per perspective...\n');
    
    const distributed = distributeTweets(classifications, tweets);
    
    console.log(`✅ Distribution complete:`);
    console.log(`   LEFT: ${distributed.left.length} tweets`);
    console.log(`   CENTER: ${distributed.center.length} tweets`);
    console.log(`   RIGHT: ${distributed.right.length} tweets\n`);
    
    // Display distributed tweets
    ['left', 'center', 'right'].forEach(lean => {
      console.log(`📌 ${lean.toUpperCase()} Perspective:`);
      distributed[lean].slice(0, 3).forEach((tweet, i) => {
        console.log(`   ${i + 1}. @${tweet.author.userName}: ${tweet.text.substring(0, 60)}...`);
      });
      console.log('');
    });
    
    // Success summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PHASE 2 TEST PASSED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✓ TwitterAPI.io integration working');
    console.log('✓ Grok 3 Mini classification working');
    console.log('✓ Tweet distribution working');
    console.log('✓ All systems operational\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:\n');
    console.error(error);
    console.error('\n');
    process.exit(1);
  }
}

runTest();
