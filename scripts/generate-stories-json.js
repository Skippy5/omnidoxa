/**
 * Generate static stories.json for Vercel deployment
 * Fetches 50 articles (10 categories × 5 each) and saves to public/stories.json
 * 
 * Usage:
 *   node scripts/generate-stories-json.js
 * 
 * Environment variables required:
 *   - NEWSDATA_API_KEY
 *   - XAI_API_KEY (optional, uses fallback sentiment if missing)
 */

const path = require('path');
const fs = require('fs');

// Import our news fetching functions
async function generateStoriesJSON() {
  console.log('🌐 Starting news fetch for 10 categories...\n');
  
  const NEWSDATA_CATEGORIES = [
    'top', 'breaking', 'technology', 'domestic', 'business', 
    'crime', 'entertainment', 'politics', 'science', 'world'
  ];
  
  const stories = [];
  let storyId = 1;
  
  // Dynamic imports (TypeScript files)
  const newsdata = await import(path.join(__dirname, '../src/lib/newsdata.ts'));
  const sentiment = await import(path.join(__dirname, '../src/lib/grok4-sentiment-direct.ts'));
  
  const fetchCategoryArticles = newsdata.fetchCategoryArticles;
  const convertToStoryWithGrok4Direct = sentiment.convertToStoryWithGrok4Direct;
  
  for (const category of NEWSDATA_CATEGORIES) {
    console.log(`📰 Fetching ${category}...`);
    
    try {
      // Fetch 5 articles for this category
      const articles = await fetchCategoryArticles(category, 5, new Set(), 50);
      
      console.log(`  ✅ Got ${articles.length} articles`);
      
      // Convert to story format with sentiment
      for (const article of articles) {
        const story = await convertToStoryWithGrok4Direct(article, storyId++, category);
        stories.push(story);
      }
      
      // Rate limiting between categories
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`  ❌ Failed to fetch ${category}:`, error.message);
    }
  }
  
  console.log(`\n📊 Total stories: ${stories.length}/50`);
  
  // Create output object
  const output = {
    stories,
    fetched_at: new Date().toISOString(),
    total: stories.length,
    categories: NEWSDATA_CATEGORIES.reduce((acc, cat) => {
      acc[cat] = stories.filter(s => s.category === cat).length;
      return acc;
    }, {})
  };
  
  // Write to public/stories.json
  const outputPath = path.join(__dirname, '../public/stories.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`\n✅ Generated stories.json:`);
  console.log(`   Location: ${outputPath}`);
  console.log(`   Size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
  console.log(`   Categories: ${Object.entries(output.categories).map(([k,v]) => `${k}:${v}`).join(', ')}`);
}

// Run it
generateStoriesJSON()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
