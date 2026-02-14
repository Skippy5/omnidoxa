# OmniDoxa Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-02-06

### Added
- **Newsdata.io API integration** - Fetches articles from 8 categories (breaking, business, crime, entertainment, politics, science, top, world)
- **Local caching system** - `news-cache.json` (104KB, 40 articles) and `grok-cache.json` (12KB, movies + local news)
- **Quick sentiment analysis** - Fast LEFT/CENTER/RIGHT political perspective analysis using xAI Grok (30-40 seconds for 20 articles)
- **NEWS_SYSTEM.md** - Complete system architecture documentation (269 lines)
- **QUICKSTART.md** - User guide for running and using OmniDoxa (148 lines)
- **New API endpoints:**
  - `/api/stories` - Converts Newsdata articles → OmniDoxa stories with viewpoints
  - `/api/news/fetch` - Refresh article cache from Newsdata.io
  - `/api/grok/fetch` - Fetch briefing data (movies, local news)
- **Libraries:**
  - `src/lib/newsdata.ts` - Newsdata.io integration
  - `src/lib/quick-sentiment.ts` - Fast sentiment analysis
  - `src/lib/omnidoxa-analysis.ts` - X.com search (for future use)

### Changed
- **News source:** Switched from Google Gemini → Newsdata.io API
- **Analysis method:** X.com search → Quick sentiment analysis (much faster)
- **Deployment model:** Static GitHub Pages → Local dev server with real-time updates
- **Cache duration:** 30 minutes for articles and stories, 1 hour for briefing data
- **Article count:** Now fetching 20 articles for display (5 per category × 4 categories shown)

### Technical Details
- Sentiment scores: -1 (negative) to +1 (positive) for LEFT/CENTER/RIGHT perspectives
- Rate limiting: 1 second delay between Grok API calls
- Model: xAI Grok-3 for all analysis
- Storage: JSON file caching for performance
- Frontend: Original OmniDoxa UI restored with sentiment sliders

### Performance
- **First load:** ~30-40 seconds (sentiment analysis for 20 articles)
- **Cached loads:** Instant (30-minute cache)
- **API costs:** ~20 Grok calls per refresh (well within limits)

---

## [0.1.0] - 2026-02-05

### Added (from previous session)
- Share card generation with canvas-rendered social media images
- Stripe Pro subscription ($4.99/mo, $49/yr)
- Pricing page with Free/Pro tiers
- Feature gating for Pro users (ad-free experience)
- Expanded from 30 → 50 stories (10 categories × 5 stories)

### Technical
- ShareButton component (306 lines)
- Stripe Checkout integration
- useProStatus hook for subscription management

---

## Initial Release - 2026-02-01

### Added
- News aggregation platform
- LEFT/CENTER/RIGHT political perspective analysis
- Sentiment bar visualization
- Category filtering
- Dark theme responsive UI
- GitHub Pages deployment
- Google Gemini AI integration
