# 🚀 Production Setup Guide - OmniDoxa on Vercel

## How It Works

**Problem:** Vercel is serverless - no persistent database or long-running processes  
**Solution:** GitHub Actions + Static JSON

### Architecture
```
GitHub Actions (runs twice daily)
  ↓
Calls https://omnidoxa.vercel.app/api/generate-static
  ↓
Generates fresh stories.json (50 articles)
  ↓
Commits to GitHub
  ↓
Vercel auto-deploys with new stories
  ↓
Users get fast page loads (static JSON)
```

## Setup Steps

### 1. Add GitHub Secret
1. Go to https://github.com/Skippy5/omnidoxa/settings/secrets/actions
2. Click "New repository secret"
3. Name: `GENERATE_SECRET`
4. Value: (generate a random string, e.g., `openssl rand -hex 32`)
5. Click "Add secret"

### 2. Add Vercel Environment Variable
1. Go to https://vercel.com/skippy5/omnidoxa/settings/environment-variables
2. Add variable:
   - **Key:** `GENERATE_SECRET`
   - **Value:** (same random string from step 1)
   - **Environments:** Production, Preview, Development
3. Click "Save"
4. Redeploy (Vercel → Deployments → ... → Redeploy)

### 3. Test the Setup

**Local test:**
```bash
# Generate stories.json locally
curl "http://localhost:3000/api/generate-static?secret=YOUR_SECRET" -o public/stories.json

# Check it worked
cat public/stories.json | grep '"total"'
```

**Production test:**
```bash
# Generate stories on Vercel
curl "https://omnidoxa.vercel.app/api/generate-static?secret=YOUR_SECRET" -o test-stories.json

# Check it worked
cat test-stories.json | grep '"total"'
```

**Manual GitHub Action trigger:**
1. Go to https://github.com/Skippy5/omnidoxa/actions
2. Click "Fetch News Stories"
3. Click "Run workflow" → "Run workflow"
4. Watch the logs - should see "✅ Generated stories.json"
5. Check commit history - should see auto-commit with stories.json

### 4. Verify It's Working
1. Wait for GitHub Action to complete
2. Check https://omnidoxa.vercel.app/
3. Should see 50 fresh articles
4. Check "Updated X ago" timestamp in header

## Schedule
- **6 AM UTC** (1 AM EST): Morning news fetch
- **6 PM UTC** (1 PM EST): Afternoon news fetch

## Manual Updates
You can trigger a fresh fetch anytime:
1. Go to https://github.com/Skippy5/omnidoxa/actions
2. Click "Fetch News Stories" → "Run workflow"
3. Wait 5 minutes for completion
4. Vercel auto-deploys with new stories

## What Gets Deployed
```
public/stories.json  (50 articles, ~200-400 KB)
  ├─ stories[]       (article data with sentiment)
  ├─ fetched_at      (timestamp)
  ├─ total           (article count)
  └─ categories      (breakdown by category)
```

## Advantages
✅ **No database costs** - uses static JSON  
✅ **No serverless timeout** - GitHub Actions handles long fetch  
✅ **Fast page loads** - static file served from CDN  
✅ **Git history** - every news fetch is tracked  
✅ **Free tier** - GitHub Actions free 2,000 min/month  
✅ **Auto-deploys** - Vercel sees commits and deploys

## Troubleshooting

**"Failed to fetch stories" on Vercel:**
- GitHub Action hasn't run yet (check Actions tab)
- GENERATE_SECRET mismatch (check both GitHub and Vercel)
- API timeout (check Vercel deployment logs)

**Stories not updating:**
- Check GitHub Actions logs for errors
- Verify NEWSDATA_API_KEY in Vercel env vars
- Check commit history (should see bot commits twice daily)

**Manual fix if needed:**
```bash
# Run generation locally
npm run dev
curl "http://localhost:3000/api/generate-static?secret=YOUR_SECRET" -o public/stories.json
git add public/stories.json
git commit -m "Manual news update"
git push
```

Vercel will deploy the updated file immediately.

## Cost Breakdown
- **Vercel hosting:** Free tier (10k requests/month)
- **GitHub Actions:** Free tier (2,000 minutes/month)  
- **Newsdata.io API:** Free tier (200 requests/day)
- **Total:** $0/month ✨

## Next Steps
Once this is working, you can:
- Add more categories
- Adjust fetch schedule (edit `.github/workflows/fetch-news.yml`)
- Add webhooks to notify when new stories arrive
- Cache stories.json in Vercel Edge for even faster loads
