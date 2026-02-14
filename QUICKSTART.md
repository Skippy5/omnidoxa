# 🚀 OmniDoxa Quick Start

## What You Have Now

✅ **Homepage with Political Sentiment Analysis**
- 20 news articles from Newsdata.io
- LEFT/CENTER/RIGHT sentiment scores (-1 to +1) for each article
- Non-biased article summaries
- Click any card to view full analysis

✅ **Quick Sentiment Analysis**
- Analyzes political perspectives without searching X.com
- Much faster: ~30-40 seconds for 20 articles
- Powered by xAI Grok-3

✅ **Background Data for Briefings** (not displayed on homepage)
- Movies for Athens, OH
- Local news (Athens, Marietta, Parkersburg)  
- Celebrity, Legal, Top US news

---

## 🌐 View OmniDoxa

**Open in browser:** http://localhost:3000

**What happens:**
1. Page loads
2. Quick sentiment analysis runs in background (~30-40 sec)
3. Stories appear with sentiment sliders
4. Click any card → View LEFT/CENTER/RIGHT analysis

---

## 🔄 Refresh Data

**Fetch fresh articles:**
```bash
curl http://localhost:3000/api/news/fetch?refresh=true
```

**Refresh stories (re-analyze sentiment):**

Just reload the page or wait for cache to expire (30 min).

---

## 📊 How Sentiment Analysis Works

**For each article, Grok analyzes:**

**LEFT Perspective** (-1 to +1)
- How would left-leaning people view this?
- Summary of left viewpoint

**CENTER Perspective** (-1 to +1)
- How would centrists view this?
- Summary of neutral viewpoint

**RIGHT Perspective** (-1 to +1)
- How would right-leaning people view this?
- Summary of right viewpoint

**Non-Biased Summary**
- Objective description of the article

---

## 🎨 UI Components

**StoryCard** - Article preview
- Title, source, thumbnail
- LEFT/CENTER/RIGHT sentiment sliders
- Click to expand

**StoryDetail** - Full analysis modal
- Non-biased summary
- LEFT section with perspective
- CENTER section with perspective
- RIGHT section with perspective
- Link to original article

**CategoryBar** - Filter by topic
- Politics, Crime, Business, etc.

---

## ⚙️ Configuration

**API Keys** (`.env.local`):
```bash
NEWSDATA_API_KEY=pub_db99c83c91184e5c9f1899b81974f802
XAI_API_KEY=your-xai-api-key-here
```

**Cache Duration:**
- Stories: 30 minutes (memory cache)
- Articles: 30 minutes (file cache)
- Movies/Local News: 1 hour (file cache)

**Analysis Settings:**
- Number of articles: 20 (configurable in `/api/stories/route.ts`)
- Rate limiting: 1 second between API calls
- Model: xAI Grok-3

---

## 🛠️ Troubleshooting

**Stories not loading?**
1. Check dev server is running: `http://localhost:3000`
2. Check console for errors
3. Refresh cache: Visit `/api/stories?refresh=true`

**Sentiment analysis slow?**
- First load takes ~30-40 seconds (analyzing 20 articles)
- Subsequent loads are instant (cached for 30 min)

**No articles?**
```bash
node scripts/fetch-initial-news.js
```

---

## 📁 Key Files

**Frontend:**
- `src/app/page.tsx` - Homepage
- `src/components/StoryCard.tsx` - Article cards
- `src/components/StoryDetail.tsx` - Analysis modal

**Backend:**
- `src/app/api/stories/route.ts` - Load stories with sentiment
- `src/lib/quick-sentiment.ts` - Fast sentiment analysis
- `src/lib/newsdata.ts` - Article fetching

**Cache:**
- `news-cache.json` - Newsdata.io articles
- `grok-cache.json` - Movies + local news (for briefings)

---

## 🚀 Next Steps

1. **Visit homepage:** http://localhost:3000
2. **Wait for analysis** (~30-40 seconds first load)
3. **Browse stories** with sentiment sliders
4. **Click a card** to see full LEFT/CENTER/RIGHT analysis

---

Built with ❤️ by Skippy the Magnificent 🍺
