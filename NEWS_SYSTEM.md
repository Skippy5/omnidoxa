# 📰 OmniDoxa Political Sentiment Analysis System

OmniDoxa shows **LEFT, CENTER, and RIGHT** political perspectives on news articles by analyzing X.com (Twitter) reactions.

## 🎯 What OmniDoxa Does

**Homepage displays:**
- News articles from Newsdata.io (40 articles, 8 categories)
- LEFT/CENTER/RIGHT sentiment sliders (-1 to +1) for each article
- Click a card to view detailed analysis

**Analysis view shows:**
- Non-biased description of the article
- **LEFT section:** Overview of left-leaning reactions + 3 tweet examples
- **CENTER section:** Overview of centrist reactions + 3 tweet examples
- **RIGHT section:** Overview of right-leaning reactions + 3 tweet examples
- Each tweet is clickable (links to original X.com post)

**What's stored but NOT displayed:**
- Movies for Athens, OH (stored for daily briefings)
- Local news (Athens OH, Marietta OH, Parkersburg WV) (stored for daily briefings)
- Celebrity/Entertainment, Legal, Top US News (stored for daily briefings)

---

## 🔧 How It Works

### 1. **Fetch News Articles** (Newsdata.io)
Pulls 40 articles from 8 categories:
- Breaking, Business, Crime, Entertainment, Politics, Science, Top, World

### 2. **Search X.com** (xAI Grok)
For each article, Grok searches X.com for:
- Tweets from LEFT-leaning users
- Tweets from CENTER/neutral users  
- Tweets from RIGHT-leaning users

### 3. **Analyze Political Sentiment** (xAI Grok)
Grok analyzes the tweets and provides:
- Sentiment score for LEFT (-1 to +1)
- Sentiment score for CENTER (-1 to +1)
- Sentiment score for RIGHT (-1 to +1)
- Summary of each perspective
- 3 tweet examples for each perspective

### 4. **Display on Homepage**
The original OmniDoxa UI shows:
- Article cards with LEFT/CENTER/RIGHT sentiment sliders
- Click to expand and view full analysis
- Direct links to source article and tweets

---

## 📂 File Structure

```
omnidoxa/
├── src/
│   ├── app/
│   │   ├── page.tsx                      # RESTORED - Original OmniDoxa homepage
│   │   ├── api/
│   │   │   ├── stories/route.ts          # NEW - Converts Newsdata → OmniDoxa stories
│   │   │   ├── news/
│   │   │   │   ├── fetch/route.ts        # Fetch Newsdata.io articles
│   │   │   │   └── all/route.ts          # Get all cached data
│   │   │   └── grok/
│   │   │       └── fetch/route.ts        # Fetch Grok data (movies + local news)
│   │   └── components/
│   │       ├── StoryCard.tsx             # Article card with sentiment sliders
│   │       ├── StoryDetail.tsx           # Analysis view (LEFT/CENTER/RIGHT)
│   │       └── CategoryBar.tsx           # Category filter
│   └── lib/
│       ├── omnidoxa-analysis.ts          # NEW - X.com search + sentiment analysis
│       ├── newsdata.ts                   # Newsdata.io integration
│       ├── grok.ts                       # xAI Grok integration
│       └── types.ts                      # Story, Viewpoint, SocialPost types
├── news-cache.json                       # Cached Newsdata.io articles
├── grok-cache.json                       # Cached movies + local news (for briefings)
└── .env.local                            # API keys
```

---

## 🔑 Environment Variables

```bash
# Newsdata.io API Key (for articles)
NEWSDATA_API_KEY=pub_db99c83c91184e5c9f1899b81974f802

# xAI Grok API Key (for X.com search + sentiment analysis)
XAI_API_KEY=your-xai-api-key-here
```

---

## 🚀 Usage

### **Initial Data Fetch**

Run once to populate article cache:

```bash
node scripts/fetch-initial-news.js
```

This fetches:
- 40 articles from Newsdata.io
- Movies + local news from xAI Grok (stored for briefings)

### **Load Stories on Homepage**

When you visit the homepage, it will:
1. Load cached Newsdata articles
2. For each article, use xAI Grok to:
   - Search X.com for political tweets
   - Analyze LEFT/CENTER/RIGHT sentiment
   - Extract 3 tweet examples per perspective
3. Display stories with sentiment sliders

**First load takes ~2 minutes** (analyzing 10 articles with rate limiting)

### **API Endpoints**

#### 1. Get OmniDoxa Stories
```bash
GET /api/stories
```

Returns articles with LEFT/CENTER/RIGHT viewpoints from X.com analysis.

**Response:**
```json
{
  "stories": [
    {
      "id": 1,
      "title": "Article title",
      "description": "Non-biased summary",
      "url": "https://...",
      "source": "CNN",
      "image_url": "https://...",
      "category": "politics",
      "viewpoints": [
        {
          "lean": "left",
          "summary": "What left-leaning people are saying...",
          "sentiment_score": -0.6,
          "social_posts": [
            {
              "author": "Jane Doe",
              "author_handle": "@janedoe",
              "text": "Tweet text...",
              "url": "https://twitter.com/janedoe/status/123",
              "likes": 500,
              "retweets": 100
            }
          ]
        },
        {
          "lean": "center",
          "summary": "What centrists are saying...",
          "sentiment_score": 0.0,
          "social_posts": [...]
        },
        {
          "lean": "right",
          "summary": "What right-leaning people are saying...",
          "sentiment_score": 0.7,
          "social_posts": [...]
        }
      ]
    }
  ],
  "fetched_at": "2026-02-07T02:45:00Z"
}
```

#### 2. Fetch News Articles (Background)
```bash
GET /api/news/fetch?refresh=true
```

Refreshes Newsdata.io article cache (40 articles).

#### 3. Fetch Movies + Local News (Background)
```bash
GET /api/grok/fetch?refresh=true
```

Refreshes Grok cache (movies + local news for briefings).

---

## 🎨 Frontend

### **Homepage** (http://localhost:3000)

**Features:**
- Article cards with category filter
- LEFT/CENTER/RIGHT sentiment sliders on each card
- Click card to open full analysis
- Analysis modal shows:
  - Non-biased article summary
  - LEFT overview + 3 tweet examples
  - CENTER overview + 3 tweet examples
  - RIGHT overview + 3 tweet examples
- All tweets are clickable (link to X.com)
- Link to original article

**UI Components:**
- `StoryCard` - Article preview with sentiment sliders
- `StoryDetail` - Full analysis view
- `CategoryBar` - Filter by category

---

## 📊 Data Flow

```
1. Newsdata.io → 40 articles (cached)
           ↓
2. xAI Grok → Search X.com for tweets about each article
           ↓
3. xAI Grok → Analyze LEFT/CENTER/RIGHT sentiment
           ↓
4. StoryWithViewpoints → Display on homepage with sliders
           ↓
5. Click card → Show full analysis with tweet examples
```

---

## 🔮 Future: Daily Briefings

**Cached but not displayed on homepage:**
- Movies (Athens, OH)
- Local news (Athens OH, Marietta OH, Parkersburg WV)
- Celebrity/Entertainment news
- Legal news (court cases)
- Top US news

These will be used later for personalized daily briefing emails/SMS.

---

## 🛠️ Maintenance

### **Refresh Articles**

```bash
curl http://localhost:3000/api/news/fetch?refresh=true
```

### **Refresh Stories (Re-analyze X.com)**

Restart the dev server or wait for cache to expire (30 minutes).

### **Check Cache**

```bash
# News articles
cat news-cache.json | jq .

# Movies + local news (for briefings)
cat grok-cache.json | jq .
```

---

## 📊 API Costs

### **Newsdata.io**
- Free tier: 200 requests/day
- Current usage: ~48/day
- ✅ Well within limits

### **xAI Grok**
- X.com search: 1 request per article
- Sentiment analysis: 1 request per article
- Total: 2 requests per article
- **First load:** ~20 requests (10 articles × 2)
- **Daily usage:** ~40 requests if cache refreshed 2x/day

---

## ✅ Testing Checklist

- [x] Newsdata.io articles cached (40 articles)
- [x] xAI Grok movies + local news cached (for briefings)
- [x] Original OmniDoxa homepage restored
- [x] X.com search integration built
- [x] Political sentiment analysis built
- [ ] **Test first load:** Visit http://localhost:3000
- [ ] **Verify LEFT/CENTER/RIGHT sliders appear**
- [ ] **Click article → View full analysis**
- [ ] **Verify tweet examples are clickable**

---

Built with ❤️ by Skippy the Magnificent 🍺
