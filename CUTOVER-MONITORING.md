# OmniDoxa Phase 5 Cutover - 7-Day Monitoring

**Cutover Date:** 2026-02-28  
**First Live Run:** 2026-02-29 at 4:00 AM EST  
**New Cron Job ID:** 26f0149c-8927-4416-8832-18fe268ea878  
**Old Cron Job:** DISABLED (commented in crontab)

---

## 📋 Daily Checklist (7 Days)

### Day 1: March 1, 2026
- [ ] Pipeline ran at 4 AM (check OpenClaw logs)
- [ ] Articles count: ~50 total (5 per category × 10 categories)
- [ ] Twitter analysis completed (viewpoints + social posts exist)
- [ ] OmniDoxa.com frontend shows fresh articles
- [ ] No critical errors in logs
- **Status:** ⏳ Pending
- **Notes:**

---

### Day 2: March 2, 2026
- [ ] Second successful run
- [ ] Article counts stable (~50)
- [ ] No errors detected
- **Status:** ⏳ Pending
- **Notes:**

---

### Day 3: March 3, 2026
- [ ] Third successful run
- [ ] Spot-check article quality (random sample)
- [ ] Viewpoints make sense
- [ ] Social posts look real
- **Status:** ⏳ Pending
- **Notes:**

---

### Day 4: March 4, 2026
- [ ] Fourth successful run
- [ ] No degradation in quality
- [ ] Skip is satisfied with results
- **Status:** ⏳ Pending
- **Notes:**

---

### Day 5: March 5, 2026
- [ ] Fifth successful run
- [ ] Performance stable
- [ ] No user complaints
- **Status:** ⏳ Pending
- **Notes:**

---

### Day 6: March 6, 2026
- [ ] Sixth successful run
- [ ] All systems green
- **Status:** ⏳ Pending
- **Notes:**

---

### Day 7: March 7, 2026
- [ ] **FINAL CHECK** - Seventh successful run
- [ ] Ready to decommission old code
- [ ] Skip approves cutover completion
- **Status:** ⏳ Pending
- **Notes:**

---

## 🚨 Rollback Procedure (If Needed)

**When to rollback:**
- Critical errors prevent daily refresh
- Article quality degrades significantly
- Data corruption detected
- Skip loses confidence

**How to rollback (5 minutes):**

```bash
# 1. Disable new OpenClaw cron
openclaw cron remove 26f0149c-8927-4416-8832-18fe268ea878

# 2. Re-enable old cron job
cat > /tmp/crontab-rollback.txt << 'EOF'
# OmniDoxa News Aggregation - Runs daily at 4am EST
0 4 * * * /home/skippy/Projects/omnidoxa/scripts/cron-fetch-news.sh
EOF
crontab /tmp/crontab-rollback.txt

# 3. Verify old cron active
crontab -l | grep fetch-news

# 4. Wait for next 4 AM run or trigger manually
cd ~/Projects/omnidoxa
npx tsx scripts/fetch-news-local.ts

# 5. Verify old pipeline worked
# Check OmniDoxa.com for fresh articles
```

**Rollback backup:** Old crontab saved in `/tmp/crontab-backup-20260228.txt`

---

## 🔍 Daily Verification Commands

**Check pipeline run status:**
```bash
openclaw cron runs 26f0149c-8927-4416-8832-18fe268ea878
```

**Check live database article counts:**
```bash
cd ~/Projects/omnidoxa
npx tsx -e "
import { turso } from './src/lib/db-turso.js';
const result = await turso.execute(\`
  SELECT category, COUNT(*) as count, MAX(created_at) as latest 
  FROM stories 
  WHERE created_at > datetime('now', '-1 day')
  GROUP BY category
  ORDER BY category
\`);
console.table(result.rows);
"
```

**Check viewpoints/social posts:**
```bash
cd ~/Projects/omnidoxa
npx tsx -e "
import { turso } from './src/lib/db-turso.js';
const viewpoints = await turso.execute('SELECT COUNT(*) as count FROM viewpoints WHERE created_at > datetime(\"now\", \"-1 day\")');
const posts = await turso.execute('SELECT COUNT(*) as count FROM social_posts');
console.log('Recent viewpoints:', viewpoints.rows[0].count);
console.log('Total social posts:', posts.rows[0].count);
"
```

**Check OpenClaw logs:**
```bash
openclaw logs | grep -A 20 "OmniDoxa"
```

---

## ✅ Success Criteria

**Phase 5 is COMPLETE when:**
1. ✅ 7 consecutive successful runs (7 days)
2. ✅ Article quality equal or better than old pipeline
3. ✅ No critical errors
4. ✅ Skip approves the cutover
5. ✅ Old code ready for removal

**After 7 days:** Proceed to cleanup (remove old code, update docs, celebrate!)

---

## 📊 Expected Metrics

**Daily run:**
- ~50 articles ingested (5 per category)
- ~0-10 duplicates removed (varies by news day)
- ~50 articles analyzed with Twitter
- ~150 viewpoints created (3 per article)
- ~300+ social posts created (varies)

**Runtime:** 5-10 minutes (well under Vercel 60s timeout, no timeout risk with OpenClaw)

**API costs:**
- Newsdata.io: 50 articles = 5 API calls (500 quota used per day)
- xAI: ~50 articles × ~20K input tokens = ~$0.50/day

---

**Status:** 🟢 Cutover executed 2026-02-28  
**Next Review:** 2026-03-07 (after 7-day monitoring)
