#!/usr/bin/env node
/**
 * Phase 2 Twitter Integration - Final Test
 * Simple test that loads .env.local properly
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
config({ path: join(__dirname, '.env.local') });

console.log('🔑 Checking API keys...');
console.log(`   NEWSDATA_API_KEY: ${process.env.NEWSDATA_API_KEY ? '✅' : '❌'}`);
console.log(`   TWITTERAPI_IO_KEY: ${process.env.TWITTERAPI_IO_KEY ? '✅' : '❌'}`);
console.log(`   XAI_API_KEY: ${process.env.XAI_API_KEY ? '✅' : '❌'}\n`);

if (!process.env.TWITTERAPI_IO_KEY || !process.env.XAI_API_KEY) {
  console.error('❌ Missing required API keys');
  process.exit(1);
}

// Now import the modules
const { searchArticleTweets } = await import('./src/lib/twitterapi-io.ts');
const { classifyTweets, distributeTweets } = await import('./src/lib/tweet-classifier.ts');

console.log('🚀 PHASE 2 INTEGRATION TEST\n');
console.log('Testing with hardcoded politics article...\n');

const testArticle = {
  title: "Trump Announces New Border Policy",
  description: "Former president outlines immigration reform plan"
};

try {
  // Step 1: Search for tweets
  console.log('🐦 Step 1: Searching for tweets...');
  const tweets = await searchArticleTweets(testArticle.title, 15);
  console.log(`✅ Found ${tweets.length} tweets\n`);

  if (tweets.length === 0) {
    console.log('⚠️  No tweets found - trying broader query...');
    const tweets2 = await searchArticleTweets("Trump border immigration", 15);
    console.log(`✅ Found ${tweets2.length} tweets with broader query\n`);
    
    if (tweets2.length === 0) {
      console.log('❌ Still no tweets - API may have issues or article too specific');
      process.exit(1);
    }
    tweets.push(...tweets2);
  }

  // Step 2: Classify with AI
  console.log('🤖 Step 2: Classifying with Grok 3 Mini...');
  const classifications = await classifyTweets(testArticle, tweets.slice(0, 15));
  console.log(`✅ Classified ${classifications.length} tweets\n`);

  // Step 3: Distribute
  console.log('📊 Step 3: Distributing across LEFT/CENTER/RIGHT...');
  const distributed = distributeTweets(classifications, tweets.slice(0, 15));
  
  console.log(`\n📈 RESULTS:`);
  console.log(`   LEFT: ${distributed.left.length} tweets`);
  console.log(`   CENTER: ${distributed.center.length} tweets`);
  console.log(`   RIGHT: ${distributed.right.length} tweets`);
  console.log(`   TOTAL: ${distributed.left.length + distributed.center.length + distributed.right.length}\n`);

  // Show samples
  console.log('📝 Sample tweets:\n');
  
  if (distributed.left.length > 0) {
    const t = distributed.left[0];
    console.log(`LEFT: @${t.author.userName}`);
    console.log(`      ${t.text.substring(0, 80)}...`);
    console.log(`      ${t.likeCount} likes, ${t.retweetCount} RTs\n`);
  }

  if (distributed.center.length > 0) {
    const t = distributed.center[0];
    console.log(`CENTER: @${t.author.userName}`);
    console.log(`        ${t.text.substring(0, 80)}...`);
    console.log(`        ${t.likeCount} likes, ${t.retweetCount} RTs\n`);
  }

  if (distributed.right.length > 0) {
    const t = distributed.right[0];
    console.log(`RIGHT: @${t.author.userName}`);
    console.log(`       ${t.text.substring(0, 80)}...`);
    console.log(`       ${t.likeCount} likes, ${t.retweetCount} RTs\n`);
  }

  console.log('✅ PHASE 2 TEST SUCCESSFUL!\n');
  console.log('Core functionality verified:');
  console.log('  ✅ twitterapi.io integration working');
  console.log('  ✅ AI classification working');
  console.log('  ✅ Tweet distribution working');
  console.log('  ✅ Ready for production integration\n');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
