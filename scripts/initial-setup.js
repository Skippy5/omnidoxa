#!/usr/bin/env node

/**
 * Initial setup script
 * Fetches articles and triggers background sentiment analysis
 */

const BASE_URL = 'http://localhost:3000';

async function initialSetup() {
  console.log('🚀 OmniDoxa Initial Setup\n');

  try {
    // Step 1: Fetch articles from Newsdata.io
    console.log('📰 Fetching articles from Newsdata.io...');
    const newsResponse = await fetch(`${BASE_URL}/api/news/fetch?refresh=true`);
    const newsData = await newsResponse.json();

    if (newsData.success) {
      console.log(`✅ Fetched ${newsData.articleCount} articles`);
      console.log(`   ${newsData.message}\n`);
    } else {
      console.error('❌ Failed to fetch articles:', newsData.error);
      process.exit(1);
    }

    // Step 2: Fetch movies + local news from xAI Grok (for briefings)
    console.log('🤖 Fetching movies and local news from xAI Grok...');
    const grokResponse = await fetch(`${BASE_URL}/api/grok/fetch?refresh=true`);
    const grokData = await grokResponse.json();

    if (grokData.success) {
      console.log(`✅ Fetched ${grokData.movieCount} movies and news from ${grokData.newsCategories} categories\n`);
    } else {
      console.warn('⚠️ Failed to fetch Grok data (non-critical)\n');
    }

    console.log('✅ Setup complete!\n');
    console.log('📊 What happens next:');
    console.log('   1. Articles are cached and ready');
    console.log('   2. X.com sentiment analysis running in background (takes 2-3 min)');
    console.log('   3. Stories will be saved to database as they\'re analyzed');
    console.log('   4. Visit http://localhost:3000 - page loads instantly!');
    console.log('   5. Refresh in 2-3 minutes to see analyzed stories with tweets\n');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

initialSetup();
