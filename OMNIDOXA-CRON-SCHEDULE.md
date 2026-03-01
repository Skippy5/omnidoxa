# OmniDoxa Automated Refresh Schedule

**Strategy:** 10 individual category jobs for maximum fault isolation and reliability  
**Analysis Strategy:** Full sentiment analysis for Top/Politics/World only (saves $105/month in API costs)

## Daily Schedule (EST)

| Time    | Category       | Analysis  | Job ID                               | Status  |
|---------|----------------|-----------|--------------------------------------|---------|
| 4:00 AM | Top Stories    | ✅ Full   | f4281229-1396-4f05-a5a5-a60b0d1ca562 | ✅ Active |
| 4:05 AM | Breaking News  | ⏭️ Skip   | cfb6ecd6-e602-46e5-a1d7-e7d047078ff0 | ✅ Active |
| 4:10 AM | Technology     | ⏭️ Skip   | 2a9885f9-f71a-44c2-bd95-8ac55f17cf00 | ✅ Active |
| 4:15 AM | Domestic       | ⏭️ Skip   | 5028fbd2-0795-4123-931b-cca7a1c22d76 | ✅ Active |
| 4:20 AM | Business       | ⏭️ Skip   | 9a57ee73-d411-4b6b-8462-f1fed0ed1efc | ✅ Active |
| 4:25 AM | Crime          | ⏭️ Skip   | 7cb8ce8f-ba04-4749-8230-0a5fb2a8522d | ✅ Active |
| 4:30 AM | Entertainment  | ⏭️ Skip   | 995851e7-727f-48d5-b390-c80476af71ff | ✅ Active |
| 4:35 AM | Politics       | ✅ Full   | 8ab919e7-81c2-4ee7-88ca-b1ee4e50a088 | ✅ Active |
| 4:40 AM | Science        | ⏭️ Skip   | bc78e5cc-942e-432d-a746-492e9245b5cf | ✅ Active |
| 4:45 AM | World          | ✅ Full   | 9eebd9e6-a3af-4c63-957b-2e42388f1843 | ✅ Active |

**Total Duration:** ~25 minutes (4:00 AM - 4:25 AM)  
**Analysis Jobs:** 3/10 (Top, Politics, World only)  
**Cost Savings:** ~$105/month (analyzing 15 articles vs 50 daily)

## Job Configuration

**Full Analysis Jobs (Top, Politics, World):**
- **Function:** `omnidoxa_refresh_categories`
- **Parameters:** Single category, 5 articles, skipAnalysis=false
- **Includes:** Article fetch + Twitter analysis (viewpoints + social posts)
- **Runtime:** ~3-5 minutes per job
- **Timeout:** 10 minutes (600 seconds)

**Lite Jobs (Breaking, Technology, Domestic, Business, Crime, Entertainment, Science):**
- **Function:** `omnidoxa_refresh_categories`
- **Parameters:** Single category, 5 articles, **skipAnalysis=true**
- **Includes:** Article fetch only (no viewpoints or social posts)
- **Runtime:** ~1-2 minutes per job
- **Timeout:** 10 minutes (600 seconds)

**All Jobs:**
- **Model:** Claude Sonnet 4.5
- **Session:** Isolated (separate from main chat)
- **Notifications:** Silent (no announcements)

## Benefits

✅ **Maximum Fault Isolation** - If one category fails, others still succeed  
✅ **No Timeout Risk** - Full analysis jobs: 3-5 min, Lite jobs: 1-2 min (well under 10-min limit)  
✅ **Easy Debugging** - Can see exactly which category succeeded/failed  
✅ **Staggered API Calls** - Reduces load on Newsdata.io API  
✅ **Modular Control** - Can disable individual categories without affecting others  
💰 **Cost Savings** - Only analyzing 3/10 categories saves ~$105/month in xAI API credits  
⚡ **Faster Execution** - Lite jobs complete 50% faster (no analysis overhead)

## Monitoring

Check tomorrow's results:
```bash
cd ~/Projects/omnidoxa
npx tsx check-run-status.ts
```

Each category will create its own pipeline run with a unique run_id.

## First Run

**Date:** February 29, 2026  
**Time:** 4:00 AM - 4:45 AM EST  
**Expected Result:** 50 total articles (5 per category × 10 categories)

---

*Created: 2026-02-28*  
*Updated: 2026-02-28*
