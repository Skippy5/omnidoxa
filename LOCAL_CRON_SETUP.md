# OmniDoxa Local Cron Setup

**Problem:** Vercel Hobby plan has a 60-second timeout limit, but OmniDoxa news aggregation takes 2-3 minutes per category (~20-30 minutes total for all 10 categories).

**Solution:** Run the news aggregation locally via cron (no timeout limits, free).

---

## ✅ What Was Set Up

### 1. Standalone News Fetch Script
**Location:** `~/Projects/omnidoxa/scripts/fetch-news-local.ts`

- Extracted from the Vercel API route (`/api/news/fetch`)
- Runs the full news aggregation pipeline locally
- Uses TypeScript via `tsx` (already installed)
- No timeout limits!

**Usage:**
```bash
# Fetch all categories (10 total, ~20-30 minutes)
npx tsx scripts/fetch-news-local.ts

# Fetch single category (for testing)
npx tsx scripts/fetch-news-local.ts politics
```

### 2. Cron Wrapper Script
**Location:** `~/Projects/omnidoxa/scripts/cron-fetch-news.sh`

- Wrapper for the fetch script that handles logging
- Logs are saved to: `~/Projects/omnidoxa/logs/cron/fetch-YYYY-MM-DD.log`
- One log file per day

### 3. Cron Job (Automatic Execution)
**Schedule:** Every 6 hours (4x daily)
- 12:00 AM (midnight)
- 6:00 AM
- 12:00 PM (noon)
- 6:00 PM

**Crontab entry:**
```
0 0,6,12,18 * * * /home/skippy/Projects/omnidoxa/scripts/cron-fetch-news.sh
```

---

## 📋 Managing the Cron Job

### View Current Cron Jobs
```bash
crontab -l
```

### Disable the Cron Job (Temporarily)
```bash
# Edit crontab
crontab -e

# Add a # at the start of the OmniDoxa line:
# 0 0,6,12,18 * * * /home/skippy/Projects/omnidoxa/scripts/cron-fetch-news.sh
```

### Enable the Cron Job (Re-enable)
```bash
# Edit crontab
crontab -e

# Remove the # at the start of the OmniDoxa line:
0 0,6,12,18 * * * /home/skippy/Projects/omnidoxa/scripts/cron-fetch-news.sh
```

### Remove the Cron Job Completely
```bash
crontab -e
# Delete the entire OmniDoxa line, save and exit
```

---

## 📊 Monitoring

### View Today's Log (Live)
```bash
tail -f ~/Projects/omnidoxa/logs/cron/fetch-$(date +%Y-%m-%d).log
```

### View Recent Logs
```bash
ls -lh ~/Projects/omnidoxa/logs/cron/
```

### Test Manually (Without Waiting for Cron)
```bash
# Test with one category (fast)
cd ~/Projects/omnidoxa
npx tsx scripts/fetch-news-local.ts politics

# Run full fetch (all 10 categories, 20-30 minutes)
~/Projects/omnidoxa/scripts/cron-fetch-news.sh
```

---

## 🔧 Troubleshooting

### Cron Job Not Running?
1. **Check cron is active:**
   ```bash
   systemctl status cron
   ```

2. **Check logs for errors:**
   ```bash
   tail -100 ~/Projects/omnidoxa/logs/cron/fetch-$(date +%Y-%m-%d).log
   ```

3. **Run manually to see errors:**
   ```bash
   ~/Projects/omnidoxa/scripts/cron-fetch-news.sh
   ```

### Environment Variables Not Loading?
The script loads from `~/Projects/omnidoxa/.env.local` automatically. Make sure:
- `.env.local` exists
- All required API keys are present (NEWSDATA_API_KEY, XAI_API_KEY, etc.)

### Script Timing Out?
This shouldn't happen (no timeout limits), but if your machine goes to sleep:
- Make sure your computer stays on during cron runs
- OR: Adjust cron times to when your computer is awake

---

## ⚠️ Important Notes

### Computer Must Be Running
- **Cron jobs only run when your computer is on**
- If you shut down or sleep your computer, cron won't run
- This is the tradeoff for free hosting

### API Rate Limits
- News API: 200 requests/day (you use ~50 per full run = 200/day with 4 runs)
- xAI API: Check your usage at https://console.x.ai/

### xAI API Key Issue (Current)
Your xAI API key is currently disabled:
```
The API key xai-...732j is disabled and cannot be used to perform requests.
To enable the API key, go to https://console.x.ai/
```

**Until you re-enable it:**
- Articles will save with keyword-based fallback (no tweets)
- The fetch will still work, but without Twitter sentiment analysis

**To fix:**
1. Go to https://console.x.ai/team/d07c090f-2999-472b-8576-819986c9e3f7/api-keys
2. Enable the API key
3. Next cron run will use xAI analysis

---

## 🚀 Next Steps

### Option A: Keep Running Locally (Free)
- ✅ Already set up and working
- ✅ No monthly costs
- ❌ Requires computer running 24/7
- ❌ No execution if computer is off/asleep

### Option B: Upgrade to Vercel Pro ($20/month)
If you want fully automated hosting without worrying about your computer:
1. Go to https://vercel.com/dashboard
2. Upgrade to Pro ($20/month)
3. Redeploy OmniDoxa
4. Disable local cron: `crontab -e` and comment out the line

**My recommendation:**
- Use local cron for now (it's working!)
- Upgrade to Vercel Pro when OmniDoxa starts making money
- Then you won't have to worry about keeping your computer on

---

## 📈 Success Metrics

After each run, check:
- **Articles saved:** Should be ~50 (5 per category × 10 categories)
- **Log file:** Should show "✅ News fetch completed successfully!"
- **Database:** Check the live site to see new articles

---

**Built by Skippy the Magnificent 🍺**
*Because Vercel's 60-second timeout is for amateurs.*
