# OmniDoxa Modular Pipeline - FINAL BATTLE-TESTED PLAN

**Version:** 2.0 (Reviewed by 4 Expert Agents)  
**Status:** Phase 2 Complete ✅  
**Timeline:** 6-8 weeks for full v1.0  

## 📊 Progress Tracker

- **Phase 1:** Foundation & Database ✅ COMPLETE (9/9 tasks)
- **Phase 2:** Twitter Analysis ✅ COMPLETE (7/7 tasks) - *Completed Feb 28, 2026*
- **Phase 3:** Re-Analysis Capability ⏸️ PENDING
- **Phase 4:** Search & Discovery ⏸️ PENDING
- **Phase 5:** Frontend & Deployment ⏸️ PENDING
- **Phase 6:** Polish & Launch ⏸️ PENDING

**Overall:** 22/41 tasks complete (54%)

---

## 🎯 Vision

**Transform OmniDoxa into a conversational, modular news analysis system.**

### Conversational Use Cases

```
Skip: "Pull fresh tech articles"
→ Fetch 50 tech articles, dedupe, analyze with Twitter, promote to live

Skip: "Re-run sentiment on politics"
→ Re-analyze existing political articles, update summaries in live DB

Skip: "Search for news about Iran bombing"
→ Ad-hoc keyword search, full analysis pipeline

Skip: "Refresh breaking news"
→ Update breaking category only
```

---

## 🔧 Critical Design Decisions (Based on Agent Reviews)

### ✅ Decision 1: LLM Function Calling (NOT Regex)

**Why:** Regex patterns fail on typos, synonyms, natural phrasing.

**Implementation:**

```typescript
// Skippy's tool definitions
const omniDoxaTools = [
  {
    name: "refresh_categories",
    description: "Fetch fresh news articles for specific categories and run Twitter analysis",
    parameters: {
      categories: { type: "array", items: { type: "string" } },
      articlesPerCategory: { type: "number", default: 5 }
    }
  },
  {
    name: "search_news",
    description: "Search for news articles by keywords or topic",
    parameters: {
      keywords: { type: "string" },
      maxArticles: { type: "number", default: 10 }
    }
  },
  {
    name: "reanalyze_category",
    description: "Re-run analysis on existing articles in a category",
    parameters: {
      category: { type: "string" },
      analysisTypes: { type: "array", items: { type: "string" } }
    }
  }
];

// When Skip says "pull fresh tech articles"
// Claude naturally calls: refresh_categories({ categories: ["technology"] })
```

**Benefits:**
- Handles typos, synonyms, natural phrasing
- No regex maintenance
- Extensible (add new functions easily)
- Skip's existing capability

---

### ✅ Decision 2: Direct Updates for Re-Analysis (NO Staging Round-Trip)

**Why:** Copying live → staging → analyze → promote is unnecessary overhead for existing data.

**Two Pipeline Modes:**

1. **NEW DATA MODE** (uses staging):
   ```
   Fetch articles → Stage → Dedupe → Analyze → Promote
   ```

2. **RE-ANALYSIS MODE** (direct updates):
   ```
   SELECT articles FROM live WHERE category = X
   → Run analysis (writes results to temp tables)
   → UPDATE live tables in transaction
   ```

**Implementation:**

```typescript
// POST /api/pipeline/reanalyze
export async function POST(request: Request) {
  const { category, analysisType } = await request.json();
  
  // 1. Get live articles
  const articles = await turso.execute({
    sql: 'SELECT * FROM stories WHERE category = ?',
    args: [category]
  });
  
  // 2. Run analysis (writes to temp tables)
  const results = await analyzeArticles(articles, analysisType);
  
  // 3. Update live in transaction
  await turso.batch([
    { sql: 'BEGIN TRANSACTION' },
    ...results.map(r => ({
      sql: 'UPDATE viewpoints SET summary = ?, sentiment_score = ? WHERE story_id = ? AND lean = ?',
      args: [r.summary, r.score, r.storyId, r.lean]
    })),
    { sql: 'COMMIT' }
  ]);
}
```

**Benefits:**
- 50% less code
- 10x simpler logic
- No staging cleanup needed
- Faster execution

---

### ✅ Decision 3: Simplified Endpoint Structure

**OLD (9+ endpoints):**
- /ingest/full
- /ingest/categories  
- /ingest/keyword
- /analyze/twitter
- /analyze/reddit
- /analyze/sentiment
- /promote/full
- /promote/categories
- /orchestrate

**NEW (4 endpoints):**

1. **POST /api/pipeline/run**
   - Handles ALL run types (full, category, keyword, re-analysis)
   - Smart routing based on config
   
2. **POST /api/pipeline/analyze**
   - Handles ALL analysis types (Twitter, Reddit, sentiment)
   - Filters by runId or articleIds
   
3. **GET /api/pipeline/status**
   - Run status, progress, errors
   
4. **DELETE /api/pipeline/cancel**
   - Cancel running pipeline

**Benefits:**
- Simpler API surface
- Easier to document/maintain
- Fewer code paths

---

## 🗄️ Final Database Schema (Agent-Reviewed)

### Staging Tables (For New Data Only)

```sql
-- Run tracker
CREATE TABLE pipeline_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_type TEXT NOT NULL CHECK(run_type IN ('full_refresh', 'category_refresh', 'keyword_search')),
  trigger_source TEXT NOT NULL CHECK(trigger_source IN ('cron', 'manual', 'conversational')),
  trigger_context TEXT,              -- JSON: { user_request, function_call, params }
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT DEFAULT 'running' CHECK(status IN ('running', 'analyzing', 'promoting', 'complete', 'failed', 'cancelled')),
  current_stage TEXT,
  error_message TEXT,
  config TEXT NOT NULL               -- JSON: { categories, keywords, target_counts, etc. }
);

-- Category tracking (for category/full runs)
CREATE TABLE category_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  target_count INTEGER DEFAULT 5,
  current_count INTEGER DEFAULT 0,
  pull_attempts INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'fetching', 'ready', 'complete', 'failed')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(run_id, category)
);

-- Staging articles
CREATE TABLE staging_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  title_normalized TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  url_normalized TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  source TEXT,
  image_url TEXT,
  published_at TEXT,
  fetched_at TEXT DEFAULT (datetime('now')),
  pull_batch INTEGER DEFAULT 1,
  status TEXT DEFAULT 'staged' CHECK(status IN ('staged', 'selected', 'rejected')),
  rejection_reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Analysis job tracking
CREATE TABLE analysis_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES staging_articles(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK(job_type IN ('twitter', 'reddit', 'ai_sentiment')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'complete', 'failed', 'skipped')),
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  UNIQUE(run_id, article_id, job_type)
);

-- Staging viewpoints
CREATE TABLE staging_viewpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES staging_articles(id) ON DELETE CASCADE,
  lean TEXT NOT NULL CHECK(lean IN ('left', 'center', 'right')),
  summary TEXT,
  sentiment_score REAL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(run_id, article_id, lean)
);

-- Staging social posts
CREATE TABLE staging_social_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  viewpoint_id INTEGER NOT NULL REFERENCES staging_viewpoints(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('twitter', 'reddit', 'threads')),
  author TEXT,
  content TEXT NOT NULL,
  url TEXT,
  platform_id TEXT,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  timestamp TEXT,
  is_real INTEGER DEFAULT 1,
  political_leaning_source TEXT,
  political_leaning_verified TEXT,
  sentiment_score REAL,
  sentiment_label TEXT CHECK(sentiment_label IN ('positive', 'negative', 'neutral', 'mixed')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Run lock (prevents concurrent NEW data runs)
CREATE TABLE pipeline_lock (
  lock_key TEXT PRIMARY KEY DEFAULT 'singleton',
  run_id INTEGER NOT NULL,
  locked_at TEXT NOT NULL,
  CHECK(lock_key = 'singleton')
);

-- INDEXES (from Database Agent review)
CREATE INDEX idx_staging_articles_run ON staging_articles(run_id, category, status);
CREATE INDEX idx_staging_articles_url ON staging_articles(url_normalized);
CREATE INDEX idx_staging_articles_hash ON staging_articles(content_hash);
CREATE INDEX idx_staging_articles_title ON staging_articles(title_normalized);
CREATE INDEX idx_analysis_jobs_lookup ON analysis_jobs(run_id, article_id, job_type, status);
CREATE INDEX idx_staging_viewpoints_lookup ON staging_viewpoints(run_id, article_id, lean);
CREATE INDEX idx_staging_posts_viewpoint ON staging_social_posts(viewpoint_id);
CREATE INDEX idx_staging_posts_article ON staging_social_posts(article_id);
CREATE INDEX idx_category_status_run ON category_status(run_id, status);
CREATE INDEX idx_runs_type_status ON pipeline_runs(run_type, status);
CREATE INDEX idx_runs_recent ON pipeline_runs(started_at DESC) WHERE status IN ('running', 'analyzing');
```

---

### Live Tables (Add Update Tracking)

```sql
-- Add to existing stories table
ALTER TABLE stories ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));
ALTER TABLE viewpoints ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));
ALTER TABLE social_posts ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));

-- Trigger to auto-update timestamps
CREATE TRIGGER update_stories_timestamp 
  AFTER UPDATE ON stories
  BEGIN
    UPDATE stories SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

CREATE TRIGGER update_viewpoints_timestamp 
  AFTER UPDATE ON viewpoints
  BEGIN
    UPDATE viewpoints SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

CREATE TRIGGER update_posts_timestamp 
  AFTER UPDATE ON social_posts
  BEGIN
    UPDATE social_posts SET updated_at = datetime('now') WHERE id = NEW.id;
  END;
```

---

## 🚀 Simplified API Design

### POST /api/pipeline/run

**Unified endpoint for all pipeline operations.**

```typescript
interface RunRequest {
  operation: "refresh_categories" | "search_news" | "reanalyze_category" | "full_refresh";
  params: {
    // For refresh_categories
    categories?: string[];
    articlesPerCategory?: number;
    
    // For search_news
    keywords?: string;
    maxArticles?: number;
    
    // For reanalyze_category
    category?: string;
    analysisTypes?: ("twitter" | "reddit" | "ai_sentiment")[];
  };
  trigger_source: "cron" | "manual" | "conversational";
  trigger_context?: {
    user_request?: string;
    function_call?: string;
    function_params?: Record<string, any>;
  };
}

interface RunResponse {
  runId?: number;              // only for NEW data operations
  operation: string;
  status: "started" | "complete";
  articlesAffected?: number;
  estimatedDuration?: number;  // seconds
}
```

**Examples:**

```bash
# Pull fresh tech articles
POST /api/pipeline/run
{
  "operation": "refresh_categories",
  "params": { "categories": ["technology"] },
  "trigger_source": "conversational",
  "trigger_context": {
    "user_request": "Pull fresh tech articles",
    "function_call": "refresh_categories",
    "function_params": { "categories": ["technology"] }
  }
}

# Search for Iran bombing news
POST /api/pipeline/run
{
  "operation": "search_news",
  "params": { "keywords": "US Iran bombing", "maxArticles": 10 },
  "trigger_source": "conversational"
}

# Re-run sentiment on politics (NO STAGING - direct update)
POST /api/pipeline/run
{
  "operation": "reanalyze_category",
  "params": { "category": "politics", "analysisTypes": ["ai_sentiment"] },
  "trigger_source": "conversational"
}
```

---

### GET /api/pipeline/status

**Get run progress and status.**

```typescript
interface StatusResponse {
  runId: number;
  operation: string;
  status: "running" | "analyzing" | "promoting" | "complete" | "failed";
  progress: {
    stage: string;
    percent: number;
    message: string;
  };
  stats: {
    articlesProcessed: number;
    articlesTotal: number;
    analysisComplete: number;
    analysisTotal: number;
  };
  errors?: string[];
  startedAt: string;
  estimatedCompletion?: string;
}
```

---

### DELETE /api/pipeline/cancel

**Cancel a running pipeline.**

```typescript
interface CancelRequest {
  runId: number;
}

interface CancelResponse {
  status: "cancelled";
  message: string;
}
```

---

## 🧠 Conversational Interface (Skippy Integration)

### Function Definitions

```typescript
// In Skippy's tool configuration
const omniDoxaFunctions = [
  {
    name: "refresh_categories",
    description: "Fetch fresh news articles for specific categories (technology, politics, science, etc.) and run Twitter analysis. Use when user asks to 'pull', 'fetch', 'refresh', or 'update' news for a category.",
    parameters: {
      type: "object",
      properties: {
        categories: {
          type: "array",
          items: { 
            type: "string",
            enum: ["breaking", "business", "crime", "entertainment", "politics", 
                   "science", "top", "world", "technology", "domestic"]
          },
          description: "News categories to refresh"
        },
        articlesPerCategory: {
          type: "number",
          default: 5,
          description: "Number of articles to fetch per category"
        }
      },
      required: ["categories"]
    }
  },
  {
    name: "search_news",
    description: "Search for news articles by keywords or topic (e.g., 'US Iran bombing', 'climate change', 'AI regulation'). Use for breaking news or specific events.",
    parameters: {
      type: "object",
      properties: {
        keywords: {
          type: "string",
          description: "Search keywords or topic"
        },
        maxArticles: {
          type: "number",
          default: 10,
          description: "Maximum articles to fetch"
        }
      },
      required: ["keywords"]
    }
  },
  {
    name: "reanalyze_category",
    description: "Re-run analysis (Twitter, Reddit, AI sentiment) on existing articles in a category. Use when user wants to 're-run', 'update analysis', or 'refresh sentiment' on existing data.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["breaking", "business", "crime", "entertainment", "politics", 
                 "science", "top", "world", "technology", "domestic"],
          description: "Category to re-analyze"
        },
        analysisTypes: {
          type: "array",
          items: {
            type: "string",
            enum: ["twitter", "reddit", "ai_sentiment"]
          },
          description: "Types of analysis to run"
        }
      },
      required: ["category", "analysisTypes"]
    }
  },
  {
    name: "get_pipeline_status",
    description: "Check status of a running OmniDoxa pipeline operation",
    parameters: {
      type: "object",
      properties: {
        runId: {
          type: "number",
          description: "Run ID to check"
        }
      },
      required: ["runId"]
    }
  }
];
```

---

### Skippy's Handler

```typescript
// When Claude calls a function via function calling
async function handleOmniDoxaFunction(functionName: string, params: any, userRequest: string) {
  const OMNIDOXA_URL = process.env.OMNIDOXA_URL;
  
  // Map function call to API operation
  const operationMap = {
    refresh_categories: "refresh_categories",
    search_news: "search_news",
    reanalyze_category: "reanalyze_category",
    get_pipeline_status: null  // uses status endpoint
  };
  
  if (functionName === "get_pipeline_status") {
    const response = await fetch(`${OMNIDOXA_URL}/api/pipeline/status?runId=${params.runId}`);
    const status = await response.json();
    return formatStatusForUser(status);
  }
  
  // Run pipeline operation
  const response = await fetch(`${OMNIDOXA_URL}/api/pipeline/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operation: operationMap[functionName],
      params,
      trigger_source: 'conversational',
      trigger_context: {
        user_request: userRequest,
        function_call: functionName,
        function_params: params
      }
    })
  });
  
  const result = await response.json();
  
  // Format natural response
  if (result.operation === "refresh_categories") {
    return `✅ On it! Fetching fresh ${params.categories.join(', ')} articles now. Run ID: ${result.runId}. Should take ~${result.estimatedDuration}s.`;
  }
  
  if (result.operation === "search_news") {
    return `🔍 Searching for news about "${params.keywords}"... Run ID: ${result.runId}. I'll let you know what I find!`;
  }
  
  if (result.operation === "reanalyze_category") {
    return `🔄 Re-running ${params.analysisTypes.join(' + ')} analysis on ${params.category} articles. ${result.articlesAffected} articles will be updated.`;
  }
}
```

---

## 🔄 Implementation Flow Examples

### Example 1: "Pull fresh tech articles"

```
1. User: "Pull fresh tech articles"

2. Claude function calling:
   refresh_categories({ categories: ["technology"] })

3. Skippy calls POST /api/pipeline/run
   {
     operation: "refresh_categories",
     params: { categories: ["technology"] },
     trigger_source: "conversational",
     trigger_context: { ... }
   }

4. Backend flow:
   a. Create run (acquires lock)
   b. Fetch 50 tech articles from Newsdata.io
   c. Stage in staging_articles
   d. Deduplicate (4-layer: URL, hash, fuzzy, cross-category)
   e. Validate count (should have 5)
   f. Run Twitter analysis (chunked, 10 articles at a time)
   g. Promote to live (UPSERT in transaction)
   h. Release lock, mark complete

5. Skippy announces: "✅ Fresh tech articles are live! 5 new stories with Twitter analysis."
```

---

### Example 2: "Re-run sentiment on politics"

```
1. User: "Re-run sentiment on politics"

2. Claude function calling:
   reanalyze_category({ 
     category: "politics", 
     analysisTypes: ["ai_sentiment"] 
   })

3. Skippy calls POST /api/pipeline/run
   {
     operation: "reanalyze_category",
     params: { category: "politics", analysisTypes: ["ai_sentiment"] },
     trigger_source: "conversational"
   }

4. Backend flow (NO STAGING):
   a. SELECT stories WHERE category = 'politics'
   b. For each article:
      - Get existing social posts from live DB
      - Run AI sentiment analysis
      - Generate new summaries
      - Collect UPDATE queries
   c. Execute all UPDATEs in single transaction:
      BEGIN TRANSACTION;
      UPDATE viewpoints SET summary = ?, sentiment_score = ? WHERE story_id = ? AND lean = ?;
      (repeat for all viewpoints)
      COMMIT;

5. Skippy announces: "✅ Politics articles re-analyzed! AI sentiment updated for 5 stories."
```

---

### Example 3: "US just bombed Iran"

```
1. User: "The US just bombed Iran, pull the relevant news stories"

2. Claude function calling:
   search_news({ keywords: "US Iran bombing" })

3. Skippy calls POST /api/pipeline/run
   {
     operation: "search_news",
     params: { keywords: "US Iran bombing", maxArticles: 10 },
     trigger_source: "conversational"
   }

4. Backend flow:
   a. Create run
   b. Call Newsdata.io with q="US Iran bombing"
   c. Fetch up to 50 recent articles
   d. Deduplicate
   e. Select top 10 most recent
   f. Run Twitter analysis
   g. Promote to live (categorize as "breaking")

5. Skippy announces: "🚨 Found 10 articles about US-Iran conflict. Twitter analysis complete. Live now."
```

---

## 📁 Final File Structure

```
src/
├── app/api/pipeline/
│   ├── run/route.ts                # Unified pipeline endpoint
│   ├── status/route.ts             # Get run status
│   └── cancel/route.ts             # Cancel run
│
├── lib/pipeline/
│   ├── orchestrator.ts             # Route operations, chain stages
│   ├── run-manager.ts              # Create/lock/unlock runs
│   ├── ingestion/
│   │   ├── full-refresh.ts         # All categories
│   │   ├── category-refresh.ts    # Specific categories
│   │   └── keyword-search.ts       # Ad-hoc search
│   ├── deduplication.ts            # 4-layer dedup
│   ├── validation.ts               # Count checks + repull
│   ├── promotion.ts                # UPSERT staging → live (with transactions)
│   ├── reanalysis.ts               # Direct live updates (NO staging)
│   └── analysis/
│       ├── twitter.ts              # xAI Grok Twitter analysis
│       ├── reddit.ts               # Reddit API (FUTURE)
│       └── ai-sentiment.ts         # LLM sentiment (FUTURE)
│
├── lib/db-staging.ts               # Staging table CRUD
└── lib/db-cloud.ts                 # Live table operations
```

---

## 🎯 Implementation Phases

### Phase 1: Foundation + New Data Pipeline (Weeks 1-3)

**Goal:** Staging DB, ingestion, dedup, promotion working for NEW data.

**Tasks:**
1. Create staging tables (use final schema above)
2. Build run manager (lock/unlock, status tracking)
3. Build ingestion modules:
   - `full-refresh.ts` - all 10 categories
   - `category-refresh.ts` - specific categories
   - `keyword-search.ts` - Newsdata.io keyword search
4. Build 4-layer deduplication (exact URL, content hash, fuzzy with pre-filter, cross-category)
5. Build validation + repull logic
6. Build promotion module (UPSERT with transactions)
7. Create `/api/pipeline/run` endpoint (operations: refresh_categories, search_news, full_refresh)
8. Create `/api/pipeline/status` endpoint

**Success Criteria:**
- Can trigger category refresh via API
- Staging tables populated correctly
- Dedup works (no duplicates in selected articles)
- Promotion succeeds without errors
- Live tables updated correctly

**Estimated Time:** 12-15 days

---

### Phase 2: Twitter Analysis Refactor (Week 3-4) ✅ COMPLETE

**Goal:** Modular Twitter analysis with chunking for Vercel 60s timeout.

**Tasks:**
1. ✅ Extract existing Twitter analysis from monolithic job
2. ✅ Refactor into `lib/pipeline/analysis/twitter.ts`:
   - Input: staging articles
   - Output: staging viewpoints + posts
   - Chunked processing (10 articles per call)
3. ✅ Add to orchestrator flow (after ingestion)
4. ✅ Test end-to-end: ingest → analyze → promote

**Success Criteria:**
- ✅ Twitter analysis produces same quality as current system
- ✅ Chunking keeps each call under 60s
- ✅ Can re-run analysis on failed articles

**Completion Date:** February 28, 2026  
**Verified By:** Testing Agent (API + Database tests passed)

---

### Phase 3: Re-Analysis (Direct Updates) (Week 4-5)

**Goal:** Enable re-running analysis on existing live data WITHOUT staging.

**Tasks:**
1. Build `lib/pipeline/reanalysis.ts`:
   - SELECT articles from live
   - Run analysis (Twitter, sentiment, etc.)
   - UPDATE live in transaction
2. Add `reanalyze_category` operation to `/run` endpoint
3. Test: re-run Twitter on politics, verify summaries update

**Success Criteria:**
- Can re-run any analysis type on existing data
- Updates happen in transaction (all-or-nothing)
- No staging overhead

**Estimated Time:** 4-5 days

---

### Phase 4: Conversational Interface (Week 5-6)

**Goal:** Skippy can trigger pipelines via natural language using function calling.

**Tasks:**
1. Define OmniDoxa functions for Claude (see above)
2. Add function handler in Skippy's main loop
3. Map function calls → API requests
4. Add natural language responses
5. Test all conversational patterns:
   - "Pull tech articles"
   - "Search for Iran news"
   - "Re-run sentiment on politics"

**Success Criteria:**
- All example commands work
- Typos/synonyms handled gracefully by Claude
- Clear feedback to user

**Estimated Time:** 3-5 days

---

### Phase 5: Shadow Mode + Cutover (Week 6-7)

**Goal:** Validate new system against old, then switch.

**Tasks:**
1. Run NEW pipeline at 4 AM (staging mode)
2. Run OLD pipeline at 5 AM (still live)
3. Compare outputs for 5-7 days
4. Fix discrepancies
5. Cutover: switch cron to new pipeline
6. Monitor for 7 days
7. Remove old code

**Success Criteria:**
- New pipeline output matches old (or is better)
- No production errors for 7 days
- Old code safely removed

**Estimated Time:** 7-10 days (mostly validation)

---

### Phase 6: Reddit Analysis (FUTURE - Week 8+)

**Goal:** Add Reddit as second social data source.

**Tasks:**
1. Build `lib/pipeline/analysis/reddit.ts`
2. Reddit API integration
3. Subreddit leaning classification
4. Add to orchestrator
5. Update function definitions

**Deferred until Phase 5 complete.**

---

### Phase 7: AI Sentiment Analysis (FUTURE - Week 9+)

**Goal:** AI verification of leanings + summaries.

**Tasks:**
1. Build `lib/pipeline/analysis/ai-sentiment.ts`
2. LLM-based leaning verification
3. LLM-based summary generation
4. Add to orchestrator

**Deferred until Phase 6 complete.**

---

## 📅 Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **Phase 1:** Foundation + New Data | 12-15 days | Staging pipeline working |
| **Phase 2:** Twitter Analysis | 5-7 days | Modular Twitter analysis |
| **Phase 3:** Re-Analysis | 4-5 days | Direct live updates |
| **Phase 4:** Conversational | 3-5 days | Function calling integration |
| **Phase 5:** Shadow + Cutover | 7-10 days | Production switch |
| **Phase 6:** Reddit | 5-7 days | Reddit integration (FUTURE) |
| **Phase 7:** AI Sentiment | 4-5 days | AI analysis (FUTURE) |

**Total for v1.0 (Phases 1-5):** ~6-8 weeks  
**Total for v2.0 (Add Reddit + AI):** ~10-12 weeks

---

## 🧪 Testing Strategy

### Unit Tests
- Deduplication logic (all 4 layers)
- URL/title normalization
- Content hashing
- Run locking mechanism

### Integration Tests
1. **Full refresh:** All 10 categories, 5 articles each
2. **Category refresh:** Just technology
3. **Keyword search:** "climate change"
4. **Re-analysis:** Update sentiment on politics
5. **Concurrent prevention:** Try to trigger two runs simultaneously
6. **Partial failure:** Twitter fails on article #5, others continue

### Manual Validation
- Compare new pipeline output with old (shadow mode)
- Test all conversational patterns
- Verify no duplicates in live data
- Check promotion transaction rollback

---

## 🚨 Critical Success Factors

1. ✅ **Use Claude function calling** (not regex) for intent parsing
2. ✅ **Direct updates for re-analysis** (no staging round-trip)
3. ✅ **Wrap promotions in transactions** (atomicity)
4. ✅ **Chunk analysis for Vercel 60s timeout**
5. ✅ **Run-level locking** (prevent concurrent NEW data runs)
6. ✅ **Progress feedback** (status endpoint + announcements)
7. ✅ **Failure notifications** (alerts when things break)
8. ✅ **Schema constraints** (CHECK, FKs, proper types)

---

## 🔧 Operational Excellence

### Monitoring
- Pipeline run success/failure rates
- Average runtime per operation
- Analysis completion rates (Twitter, Reddit, sentiment)
- Live data freshness (time since last update)

### Alerting
- Pipeline run failures → Slack/Telegram
- Analysis timeouts → Log + retry
- Promotion failures → CRITICAL alert
- Lock held >10 minutes → Warning

### Retention
- Full refresh staging: 30 days
- Category refresh staging: 14 days
- Keyword search staging: 7 days
- Auto-cleanup cron (weekly)

### Logging
- Every API call logged with request ID
- Run lifecycle events (started, stage transitions, completed)
- Analysis job tracking (pending → running → complete/failed)
- Promotion transaction logs

---

## 💡 Future Enhancements (v3.0+)

1. **Multi-source aggregation:** Merge Twitter + Reddit posts into unified viewpoints
2. **Trend detection:** "Politics sentiment shifting left over 3 days"
3. **Auto-refresh triggers:** Breaking news detected → auto-pull related stories
4. **Custom analysis plugins:** Define new analysis types without code changes
5. **Scheduled partial refreshes:** Tech every 2 hours, others daily
6. **Request queuing:** Handle rapid commands gracefully
7. **Category-level locking:** Allow concurrent refreshes on different categories

---

## 🍺 Final Verdict

This plan has been **battle-tested by 4 expert agents** and incorporates all critical fixes:

- ✅ LLM function calling (not regex)
- ✅ Direct re-analysis updates (no staging overhead)
- ✅ Simplified API (4 endpoints, not 9)
- ✅ Transaction-wrapped promotions
- ✅ Proper schema constraints
- ✅ Realistic 6-8 week timeline

**Ready for implementation. Let's build this thing.** 🏗️
