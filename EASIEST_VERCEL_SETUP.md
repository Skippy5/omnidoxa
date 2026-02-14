# Easiest Vercel Setup - Static JSON Method

## Problem
- Vercel KV is deprecated → Upstash Redis
- Vercel Postgres is deprecated → Neon  
- Both require additional setup

## Simplest Solution
Generate static `public/stories.json` and update it via GitHub Actions (free!)

## How It Works
1. **GitHub Action runs twice daily** (6 AM & 6 PM)
2. Fetches 50 fresh articles
3. Commits `public/stories.json` to repo
4. Vercel auto-deploys with updated stories

## Setup

### 1. Create GitHub Action
File: `.github/workflows/fetch-news.yml`

```yaml
name: Fetch News Stories

on:
  schedule:
    - cron: '0 6,18 * * *'  # 6 AM & 6 PM UTC
  workflow_dispatch:  # Manual trigger button

jobs:
  fetch-news:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Fetch news and generate stories.json
        env:
          NEWSDATA_API_KEY: ${{ secrets.NEWSDATA_API_KEY }}
          XAI_API_KEY: ${{ secrets.XAI_API_KEY }}
        run: |
          node scripts/generate-stories-json.js
          
      - name: Commit and push if changed
        run: |
          git config --global user.name 'GitHub Action'
          git config --global user.email 'action@github.com'
          git add public/stories.json
          git diff --quiet && git diff --staged --quiet || \
            (git commit -m "Auto-update news stories [skip ci]" && git push)
```

### 2. Create Generation Script
File: `scripts/generate-stories-json.js`

```javascript
const { fetchAllCategories } = require('../src/lib/newsdata');
const { convertToStoryWithGrok4Direct } = require('../src/lib/grok4-sentiment-direct');
const fs = require('fs');
const path = require('path');

async function generateStoriesJSON() {
  console.log('🌐 Fetching stories from all 10 categories...');
  
  const allArticles = await fetchAllCategories(5); // 5 per category
  const stories = [];
  
  let storyId = 1;
  for (const [category, articles] of Object.entries(allArticles)) {
    for (const article of articles) {
      const story = await convertToStoryWithGrok4Direct(article, storyId++, category);
      stories.push(story);
    }
  }
  
  const output = {
    stories,
    fetched_at: new Date().toISOString(),
    total: stories.length
  };
  
  const outputPath = path.join(__dirname, '../public/stories.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`✅ Generated ${stories.length} stories → public/stories.json`);
}

generateStoriesJSON().catch(console.error);
```

### 3. Add GitHub Secrets
1. Go to https://github.com/Skippy5/omnidoxa/settings/secrets/actions
2. Add secrets:
   - `NEWSDATA_API_KEY` - Your Newsdata.io key
   - `XAI_API_KEY` - Your xAI key

### 4. Update Frontend
The frontend already tries `public/stories.json` first! (in `page.tsx`)
```typescript
const res = await fetch(`${BASE_PATH}/stories.json`);
```

### 5. Test Manually
1. Go to https://github.com/Skippy5/omnidoxa/actions
2. Click "Fetch News Stories"
3. Click "Run workflow"
4. Watch it fetch news and commit `public/stories.json`

## Advantages
✅ **No Vercel costs** - uses GitHub Actions (free 2,000 min/month)  
✅ **No database** - stories.json is static  
✅ **Auto-deploys** - Vercel sees the commit and redeploys  
✅ **Git history** - Can see every news fetch in commits  
✅ **Works offline** - Clone repo = have all stories

## How Users See It
- Fast page loads (static JSON)
- Updates twice daily (6 AM & 6 PM)
- No "Failed to fetch" errors
- Works perfectly on Vercel free tier

## Manual Trigger
Just run the script locally:
```bash
node scripts/generate-stories-json.js
git add public/stories.json
git commit -m "Update news stories"
git push
```

Vercel auto-deploys!
