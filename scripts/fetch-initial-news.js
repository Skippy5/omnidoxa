#!/usr/bin/env node

/**
 * Fetch initial news data
 * - Pulls articles from Newsdata.io (8 categories x 5 articles)
 * - Pulls movies + local news from xAI Grok
 * - Adds sentiment analysis to all articles
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function fetchInitialNews() {
  console.log('🚀 Starting initial news fetch...\n');

  try {
    // Step 1: Fetch Newsdata.io articles
    console.log('📰 Fetching articles from Newsdata.io...');
    const newsResponse = await fetch(`${BASE_URL}/api/news/fetch?refresh=true`);
    const newsData = await newsResponse.json();

    if (newsData.success) {
      console.log(`✅ Fetched ${newsData.articleCount} articles from Newsdata.io`);
      console.log(`   Source: ${newsData.source}`);
      console.log(`   Updated: ${newsData.lastUpdated}\n`);
    } else {
      console.error('❌ Failed to fetch Newsdata.io articles:', newsData.error);
    }

    // Step 2: Fetch Grok data (movies + local news)
    console.log('🤖 Fetching movies and local news from xAI Grok...');
    const grokResponse = await fetch(`${BASE_URL}/api/grok/fetch?refresh=true`);
    const grokData = await grokResponse.json();

    if (grokData.success) {
      console.log(`✅ Fetched ${grokData.movieCount} movies and news from ${grokData.newsCategories} categories`);
      console.log(`   Source: ${grokData.source}`);
      console.log(`   Updated: ${grokData.lastUpdated}\n`);
    } else {
      console.error('❌ Failed to fetch Grok data:', grokData.error);
    }

    console.log('🎉 Initial news fetch complete!\n');
    console.log('📊 Summary:');
    console.log(`   - News articles: ${newsData.articleCount || 0}`);
    console.log(`   - Movies: ${grokData.movieCount || 0}`);
    console.log(`   - News categories: ${grokData.newsCategories || 0}`);
    console.log('\n💡 View the news at: http://localhost:3000/news');

  } catch (error) {
    console.error('❌ Error during initial fetch:', error.message);
    process.exit(1);
  }
}

fetchInitialNews();
