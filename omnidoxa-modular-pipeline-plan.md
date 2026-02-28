# OmniDoxa Modular Pipeline - Conversational Control Design

## 📊 Progress Tracker

- **Phase 1:** Modular Foundation ✅ COMPLETE
- **Phase 2:** Twitter Analysis + Re-Analysis ✅ COMPLETE (Feb 28, 2026)
- **Phase 3:** Conversational Interface ⏸️ PENDING
- **Phase 4:** Reddit Analysis ⏸️ FUTURE
- **Phase 5:** AI Sentiment Analysis ⏸️ FUTURE

**Current Status:** Phase 2 Complete - Ready for Phase 3

---

## Vision

**Transform OmniDoxa from a scheduled batch job into an interactive, conversational news analysis system.**

### Conversational Use Cases (CTQs)

```
Skip: "Skippy, please pull new technology articles"
→ Fetch 50 tech articles, dedupe, analyze with Twitter, promote to live

Skip: "Skippy, re-run the sentiment analysis on the political articles"
→ Re-analyze existing political articles with AI sentiment, update live data

Skip: "Skippy, the US just bombed Iran, pull relevant news stories and run sentiment analysis"
→ Ad-hoc keyword search ("US Iran bombing"), fetch articles, full analysis pipeline

Skip: "Skippy, refresh all breaking news"
→ Fetch breaking category only, run full pipeline

Skip: "Skippy, re-run Twitter analysis on article #42"
→ Targeted re-analysis of single article
```

### Core Architectural Principles

1. ✅ **Every pipeline stage is independently callable** with flexible filters
2. ✅ **Every stage accepts multiple input modes** (full refresh, category filter, article IDs, keywords)
3. ✅ **Conversational intent → API parameters** translation layer
4. ✅ **Idempotent operations** - safe to re-run any stage on any data
5. ✅ **Atomic promotion** - partial updates supported (e.g., just political category)
6. ✅ **Audit trail** - every run records what was requested and why

---

## 🗄️ Database Schema - Modular Run Types

### Enhanced Run Tracking

```sql
-- Master run tracker (supports multiple run types)
CREATE TABLE pipeline_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_type TEXT NOT NULL,                 -- 'full_refresh' | 'category_refresh' | 'keyword_search' | 're_analysis' | 'single_article'
  trigger_source TEXT NOT NULL,           -- 'cron' | 'manual' | 'conversational'
  trigger_context TEXT,                   -- JSON: conversational request, user_id, etc.
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT DEFAULT 'running',          -- running | analyzing | promoting | complete | failed
  current_stage TEXT,
  error_message TEXT,
  config TEXT NOT NULL                    -- JSON: categories, keywords, article_ids, analysis_types, etc.
);

-- Enhanced category tracking (optional for category-based runs)
CREATE TABLE category_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  target_count INTEGER DEFAULT 5,
  current_count INTEGER DEFAULT 0,
  pull_attempts INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(run_id, category)
);

-- Staging articles (unchanged from previous plan)
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
  status TEXT DEFAULT 'staged',
  rejection_reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Enhanced analysis job tracking (supports re-analysis)
CREATE TABLE analysis_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES staging_articles(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,                 -- 'twitter' | 'reddit' | 'ai_sentiment'
  status TEXT DEFAULT 'pending',
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  is_reanalysis INTEGER DEFAULT 0,        -- NEW: 1 if this is re-running on existing data
  previous_job_id INTEGER,                -- NEW: links to previous analysis for comparison
  UNIQUE(run_id, article_id, job_type)
);

-- Staging viewpoints (unchanged)
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

-- Staging social posts (unchanged)
CREATE TABLE staging_social_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  viewpoint_id INTEGER NOT NULL REFERENCES staging_viewpoints(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL,
  source TEXT NOT NULL,
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
  sentiment_label TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Run-level lock (unchanged)
CREATE TABLE pipeline_lock (
  lock_key TEXT PRIMARY KEY DEFAULT 'singleton',
  run_id INTEGER NOT NULL,
  locked_at TEXT NOT NULL,
  CHECK(lock_key = 'singleton')
);

-- INDEXES (same as before)
CREATE INDEX idx_staging_articles_run ON staging_articles(run_id, category, status);
CREATE INDEX idx_staging_articles_url ON staging_articles(url_normalized);
CREATE INDEX idx_staging_articles_hash ON staging_articles(content_hash);
CREATE INDEX idx_staging_articles_title ON staging_articles(title_normalized);
CREATE INDEX idx_analysis_jobs_lookup ON analysis_jobs(run_id, article_id, job_type, status);
CREATE INDEX idx_staging_viewpoints_lookup ON staging_viewpoints(run_id, article_id, lean);
CREATE INDEX idx_staging_posts_viewpoint ON staging_social_posts(viewpoint_id);
CREATE INDEX idx_staging_posts_article ON staging_social_posts(article_id);
CREATE INDEX idx_category_status_run ON category_status(run_id, status);
```

---

## 🚀 API Design - Modular Endpoints

### **1. Ingestion Endpoints**

#### `POST /api/pipeline/ingest/full`
**Full refresh** - All 10 categories, 5 articles each

```typescript
Request: { trigger_source: "cron" | "manual" | "conversational" }
Response: { runId: number, status: "started" }
```

#### `POST /api/pipeline/ingest/categories`
**Category-specific refresh** - "Pull new technology articles"

```typescript
Request: { 
  categories: string[],           // e.g., ["technology", "science"]
  articlesPerCategory?: number,   // default: 5
  trigger_source: string,
  trigger_context?: string        // conversational request text
}
Response: { runId: number, categories: string[], status: "started" }
```

#### `POST /api/pipeline/ingest/keyword`
**Ad-hoc keyword/topic search** - "US just bombed Iran"

```typescript
Request: {
  keywords: string,               // e.g., "US Iran bombing"
  category?: string,              // optional category constraint
  maxArticles?: number,           // default: 10
  dateRange?: {                   // optional time filter
    from?: string,                // ISO timestamp
    to?: string
  },
  trigger_source: string,
  trigger_context?: string
}
Response: { runId: number, articlesFound: number, status: "started" }
```

**Implementation:** Use Newsdata.io's `q` (query) parameter with keyword search.

---

### **2. Analysis Endpoints**

#### `POST /api/pipeline/analyze/twitter`
**Twitter analysis** - Flexible filtering

```typescript
Request: {
  runId?: number,                 // analyze staging articles from this run
  articleIds?: number[],          // OR analyze specific live article IDs
  categories?: string[],          // OR analyze specific categories from live
  forceReanalysis?: boolean,      // if true, re-run even if already analyzed
  offset?: number,                // for chunking (Vercel 60s timeout)
  limit?: number                  // default: 10
}
Response: { 
  processed: number, 
  remaining: number, 
  status: "in_progress" | "complete" 
}
```

**Behavior:**
- If `runId` provided → analyze staging articles
- If `articleIds` provided → pull live articles into staging, analyze
- If `categories` provided → pull live articles by category into staging, analyze
- Chunked processing for Vercel timeout safety

#### `POST /api/pipeline/analyze/reddit` (FUTURE)
Same structure as Twitter endpoint.

#### `POST /api/pipeline/analyze/sentiment` (FUTURE)
Same structure as Twitter endpoint.

---

### **3. Promotion Endpoints**

#### `POST /api/pipeline/promote/full`
**Promote entire run** - Staging → Live (all categories)

```typescript
Request: { runId: number }
Response: { 
  articlesPromoted: number, 
  viewpointsPromoted: number, 
  postsPromoted: number,
  status: "success" 
}
```

#### `POST /api/pipeline/promote/categories`
**Promote specific categories** - Partial promotion

```typescript
Request: { 
  runId: number,
  categories: string[]            // e.g., ["technology"]
}
Response: { 
  articlesPromoted: number, 
  categoriesPromoted: string[],
  status: "success" 
}
```

**Use case:** "Just update the tech section, leave everything else alone"

---

### **4. Orchestration Endpoints**

#### `POST /api/pipeline/orchestrate`
**Smart orchestrator** - Interprets run config and chains stages

```typescript
Request: {
  runType: "full_refresh" | "category_refresh" | "keyword_search" | "re_analysis",
  config: {
    categories?: string[],
    keywords?: string,
    articleIds?: number[],
    analysisTypes?: ("twitter" | "reddit" | "ai_sentiment")[],
    promoteOnComplete?: boolean   // default: true
  },
  trigger_source: string,
  trigger_context?: string
}
Response: { runId: number, stages: string[], status: "started" }
```

**Behavior:**
- Creates run record with config
- Determines stage sequence based on `runType`
- Triggers stages sequentially
- Auto-promotes if `promoteOnComplete = true`

**Example flows:**

```typescript
// "Pull new technology articles"
{
  runType: "category_refresh",
  config: {
    categories: ["technology"],
    analysisTypes: ["twitter"],
    promoteOnComplete: true
  }
}
→ ingest/categories → analyze/twitter → promote/categories

// "Re-run sentiment analysis on political articles"
{
  runType: "re_analysis",
  config: {
    categories: ["politics"],
    analysisTypes: ["ai_sentiment"],
    promoteOnComplete: true
  }
}
→ (skip ingestion) → analyze/sentiment → promote/categories

// "US just bombed Iran, pull relevant news"
{
  runType: "keyword_search",
  config: {
    keywords: "US Iran bombing",
    analysisTypes: ["twitter", "ai_sentiment"],
    promoteOnComplete: true
  }
}
→ ingest/keyword → analyze/twitter → analyze/sentiment → promote/full
```

---

### **5. Utility Endpoints**

#### `GET /api/pipeline/status?runId=X`
Get run progress, stage status, errors.

#### `GET /api/pipeline/runs?limit=10&runType=category_refresh`
List recent runs with filters.

#### `DELETE /api/pipeline/runs/:runId`
Cancel a running pipeline (sets status to 'cancelled', releases lock).

---

## 🧠 Conversational Interface Layer

### **Skippy AI → API Translation**

When Skip says conversational commands, I (Skippy the AI) translate to API calls:

```typescript
// lib/conversational/pipeline-intent.ts

interface PipelineIntent {
  action: "ingest" | "analyze" | "promote" | "orchestrate";
  runType: string;
  config: Record<string, any>;
  trigger_context: string;
}

export function parseIntent(userMessage: string): PipelineIntent | null {
  const lower = userMessage.toLowerCase();
  
  // Pattern: "pull new {category} articles"
  if (lower.match(/pull (new )?(\w+) articles?/)) {
    const category = extractCategory(userMessage);  // "technology" → "technology"
    return {
      action: "orchestrate",
      runType: "category_refresh",
      config: {
        categories: [category],
        analysisTypes: ["twitter"],
        promoteOnComplete: true
      },
      trigger_context: userMessage
    };
  }
  
  // Pattern: "re-run {analysis_type} on {category}"
  if (lower.match(/re-?run (twitter|sentiment|reddit) (analysis )?on (\w+)/)) {
    const analysisType = extractAnalysisType(userMessage);  // "sentiment" → "ai_sentiment"
    const category = extractCategory(userMessage);
    return {
      action: "orchestrate",
      runType: "re_analysis",
      config: {
        categories: [category],
        analysisTypes: [analysisType],
        promoteOnComplete: true
      },
      trigger_context: userMessage
    };
  }
  
  // Pattern: "pull news about {keywords}"
  if (lower.match(/pull (news|articles|stories) (about|on|regarding) (.+)/)) {
    const keywords = extractKeywords(userMessage);
    return {
      action: "orchestrate",
      runType: "keyword_search",
      config: {
        keywords,
        analysisTypes: ["twitter"],
        promoteOnComplete: true
      },
      trigger_context: userMessage
    };
  }
  
  // Pattern: "refresh {category}"
  if (lower.match(/refresh (\w+)/)) {
    const category = extractCategory(userMessage);
    return {
      action: "orchestrate",
      runType: "category_refresh",
      config: {
        categories: [category === "all" ? null : category],
        analysisTypes: ["twitter"],
        promoteOnComplete: true
      },
      trigger_context: userMessage
    };
  }
  
  return null;  // unrecognized intent
}

// Helper: extract category from natural language
function extractCategory(message: string): string {
  const categoryMap: Record<string, string> = {
    "tech": "technology",
    "tech": "technology",
    "sci": "science",
    "science": "science",
    "pol": "politics",
    "politics": "politics",
    "breaking": "breaking",
    "business": "business",
    "biz": "business",
    "crime": "crime",
    "entertainment": "entertainment",
    "sports": "top",  // might need to add sports as category
    "world": "world",
    "domestic": "domestic"
  };
  
  for (const [key, value] of Object.entries(categoryMap)) {
    if (message.toLowerCase().includes(key)) {
      return value;
    }
  }
  
  return "top";  // fallback
}

function extractAnalysisType(message: string): string {
  if (message.includes("twitter")) return "twitter";
  if (message.includes("reddit")) return "reddit";
  if (message.includes("sentiment")) return "ai_sentiment";
  return "twitter";  // fallback
}

function extractKeywords(message: string): string {
  // Extract everything after "about/on/regarding"
  const match = message.match(/(?:about|on|regarding)\s+(.+?)(?:\s+and|$)/i);
  return match ? match[1].trim() : message;
}
```

### **Skippy's Response Handler**

When Skip gives a conversational command:

```typescript
// In Skippy's main agent loop
const userMessage = "Skippy, pull new technology articles";

const intent = parseIntent(userMessage);

if (intent) {
  // Translate intent → API call
  const response = await fetch(`${OMNIDOXA_URL}/api/pipeline/orchestrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      runType: intent.runType,
      config: intent.config,
      trigger_source: 'conversational',
      trigger_context: intent.trigger_context
    })
  });
  
  const result = await response.json();
  
  // Respond naturally
  return `✅ On it, boss! Pulling fresh technology articles now. Run ID: ${result.runId}. I'll let you know when it's live.`;
} else {
  return "I didn't catch that. Try: 'pull new tech articles', 'refresh politics', or 'search for news about X'.";
}
```

---

## 🔄 Workflow Examples

### Example 1: "Pull new technology articles"

```
1. User: "Skippy, pull new technology articles"

2. Skippy parses intent:
   {
     action: "orchestrate",
     runType: "category_refresh",
     config: { categories: ["technology"], analysisTypes: ["twitter"] }
   }

3. POST /api/pipeline/orchestrate
   → Creates run_id = 42
   → Config: { categories: ["technology"], target: 5 }

4. Orchestrator chains:
   a. POST /api/pipeline/ingest/categories (runId=42, categories=["technology"])
      → Fetches 50 tech articles
      → Deduplicates → 5 selected
   
   b. POST /api/pipeline/analyze/twitter (runId=42)
      → Analyzes 5 articles (chunked if needed)
      → Writes to staging_viewpoints + staging_social_posts
   
   c. POST /api/pipeline/promote/categories (runId=42, categories=["technology"])
      → UPSERTs 5 tech articles + viewpoints + posts to live tables
      → Only overwrites technology category, leaves others untouched

5. Skippy announces: "✅ Fresh tech articles are live! 5 new stories with Twitter analysis."
```

---

### Example 2: "Re-run sentiment analysis on political articles"

```
1. User: "Skippy, re-run the sentiment analysis on the political articles"

2. Skippy parses intent:
   {
     action: "orchestrate",
     runType: "re_analysis",
     config: { categories: ["politics"], analysisTypes: ["ai_sentiment"] }
   }

3. POST /api/pipeline/orchestrate
   → Creates run_id = 43
   → Config: { reanalysis: true, categories: ["politics"] }

4. Orchestrator chains:
   a. (SKIP ingestion - data already exists in live)
   
   b. Load live political articles into staging:
      → SELECT * FROM stories WHERE category = 'politics'
      → INSERT INTO staging_articles (run_id=43, ...)
      → Copy existing viewpoints + social_posts to staging
   
   c. POST /api/pipeline/analyze/sentiment (runId=43)
      → Re-runs AI sentiment on existing posts
      → Verifies political leanings
      → Generates new summaries
      → Writes updated data to staging_viewpoints
   
   d. POST /api/pipeline/promote/categories (runId=43, categories=["politics"])
      → UPSERTs updated viewpoints to live
      → Old summaries replaced with new AI-generated ones

5. Skippy announces: "✅ Political articles re-analyzed with AI sentiment. Summaries updated."
```

---

### Example 3: "US just bombed Iran, pull relevant news"

```
1. User: "Skippy, the US just bombed Iran, pull the relevant news stories and run the sentiment analysis"

2. Skippy parses intent:
   {
     action: "orchestrate",
     runType: "keyword_search",
     config: { 
       keywords: "US Iran bombing", 
       analysisTypes: ["twitter", "ai_sentiment"] 
     }
   }

3. POST /api/pipeline/orchestrate
   → Creates run_id = 44
   → Config: { keywords: "US Iran bombing", maxArticles: 10 }

4. Orchestrator chains:
   a. POST /api/pipeline/ingest/keyword (runId=44, keywords="US Iran bombing")
      → Calls Newsdata.io with q="US Iran bombing"
      → Fetches up to 50 recent articles
      → Deduplicates
      → Selects top 10 most recent
   
   b. POST /api/pipeline/analyze/twitter (runId=44)
      → Analyzes 10 articles with Twitter analysis
   
   c. POST /api/pipeline/analyze/sentiment (runId=44)
      → Runs AI sentiment verification on collected posts
   
   d. POST /api/pipeline/promote/full (runId=44)
      → Adds 10 new articles to live database
      → (These might go into "breaking" or "world" category)

5. Skippy announces: "🚨 Breaking: Found 10 articles about US-Iran conflict. Twitter + AI sentiment analysis complete. Live now."
```

---

## 🧩 Modular Re-Analysis Strategy

### Problem: "Re-run analysis on existing data"

When Skip says "re-run sentiment on politics", we need to:
1. Pull existing live articles into staging
2. Preserve existing analysis data (Twitter posts)
3. Re-run only the requested analysis type (AI sentiment)
4. Promote updated results back to live

### Solution: "Copy-to-Staging" Helper

```typescript
// lib/pipeline/re-analysis.ts

export async function loadLiveDataToStaging(
  runId: number,
  filter: {
    categories?: string[],
    articleIds?: number[]
  }
): Promise<void> {
  // 1. Copy articles from live to staging
  await turso.execute({
    sql: `
      INSERT INTO staging_articles (
        run_id, category, title, title_normalized, description, 
        url, url_normalized, content_hash, source, image_url, 
        published_at, fetched_at, status
      )
      SELECT 
        ? as run_id, category, title, title, description,
        url, url, '', source, image_url,
        published_at, datetime('now'), 'selected'
      FROM stories
      WHERE ${filter.categories ? 'category IN (?)' : '1=1'}
        ${filter.articleIds ? 'AND id IN (?)' : ''}
    `,
    args: [runId, filter.categories || [], filter.articleIds || []]
  });
  
  // 2. Copy existing viewpoints to staging
  await turso.execute({
    sql: `
      INSERT INTO staging_viewpoints (
        run_id, article_id, lean, summary, sentiment_score
      )
      SELECT 
        ? as run_id, v.story_id, v.lean, v.summary, v.sentiment_score
      FROM viewpoints v
      JOIN stories s ON v.story_id = s.id
      WHERE ${filter.categories ? 's.category IN (?)' : '1=1'}
        ${filter.articleIds ? 'AND s.id IN (?)' : ''}
    `,
    args: [runId, filter.categories || [], filter.articleIds || []]
  });
  
  // 3. Copy existing social posts to staging
  await turso.execute({
    sql: `
      INSERT INTO staging_social_posts (
        run_id, viewpoint_id, article_id, source, author, content,
        url, platform_id, likes, retweets, timestamp, is_real,
        political_leaning_source, political_leaning_verified,
        sentiment_score, sentiment_label
      )
      SELECT 
        ? as run_id, sp.viewpoint_id, v.story_id, sp.source, sp.author, sp.content,
        sp.url, sp.platform_id, sp.likes, sp.retweets, sp.timestamp, sp.is_real,
        sp.political_leaning_source, sp.political_leaning_verified,
        sp.sentiment_score, sp.sentiment_label
      FROM social_posts sp
      JOIN viewpoints v ON sp.viewpoint_id = v.id
      JOIN stories s ON v.story_id = s.id
      WHERE ${filter.categories ? 's.category IN (?)' : '1=1'}
        ${filter.articleIds ? 'AND s.id IN (?)' : ''}
    `,
    args: [runId, filter.categories || [], filter.articleIds || []]
  });
}
```

**Usage in re-analysis flow:**

```typescript
// POST /api/pipeline/orchestrate with runType="re_analysis"

if (runType === "re_analysis") {
  // Load existing live data into staging
  await loadLiveDataToStaging(runId, { categories: config.categories });
  
  // Run only the requested analysis types
  for (const analysisType of config.analysisTypes) {
    await fetch(`/api/pipeline/analyze/${analysisType}?runId=${runId}`, { method: 'POST' });
  }
  
  // Promote updated results
  await fetch(`/api/pipeline/promote/categories?runId=${runId}`, { 
    method: 'POST',
    body: JSON.stringify({ categories: config.categories })
  });
}
```

---

## 📁 Updated File Structure

```
src/
├── app/api/pipeline/
│   ├── orchestrate/route.ts              # Smart orchestrator (chains stages)
│   ├── ingest/
│   │   ├── full/route.ts                 # Full refresh (all categories)
│   │   ├── categories/route.ts           # Category-specific refresh
│   │   └── keyword/route.ts              # Ad-hoc keyword search
│   ├── analyze/
│   │   ├── twitter/route.ts              # Twitter analysis (flexible filtering)
│   │   ├── reddit/route.ts               # Reddit analysis (FUTURE)
│   │   └── sentiment/route.ts            # AI sentiment (FUTURE)
│   ├── promote/
│   │   ├── full/route.ts                 # Promote entire run
│   │   └── categories/route.ts           # Promote specific categories
│   ├── status/route.ts                   # Get run status
│   └── runs/route.ts                     # List/cancel runs
│
├── lib/pipeline/
│   ├── run-manager.ts                    # Create/lock/unlock runs
│   ├── ingestion.ts                      # Newsdata.io fetch logic
│   ├── deduplication.ts                  # 4-layer dedup
│   ├── validation.ts                     # Count checks + repull
│   ├── promotion.ts                      # UPSERT staging → live
│   ├── re-analysis.ts                    # Copy live → staging for re-analysis
│   └── analysis/
│       ├── twitter.ts                    # xAI Grok Twitter analysis
│       ├── reddit.ts                     # Reddit API (FUTURE)
│       └── ai-sentiment.ts               # LLM sentiment (FUTURE)
│
├── lib/conversational/
│   └── pipeline-intent.ts                # Natural language → API translation
│
├── lib/db-staging.ts                     # Staging table CRUD
└── lib/db-cloud.ts                       # Live table operations
```

---

## 🎯 Implementation Phases (Revised)

### Phase 1: Modular Foundation (Week 1-2)
**Goal:** All core endpoints functional, no conversational layer yet

**Tasks:**
1. Create enhanced schema (with `run_type`, `trigger_source`, etc.)
2. Build ingestion endpoints:
   - `/ingest/full`
   - `/ingest/categories`
   - `/ingest/keyword`
3. Build deduplication + validation logic (reusable across all ingest types)
4. Build promotion endpoints:
   - `/promote/full`
   - `/promote/categories`
5. Build `/orchestrate` basic flow (no intent parsing yet)

**Success Criteria:**
- Can manually trigger category refresh via API
- Can manually trigger keyword search via API
- Can promote partial results (e.g., just technology category)

---

### Phase 2: Twitter Analysis + Re-Analysis (Week 2-3) ✅ COMPLETE
**Goal:** Modular Twitter analysis with re-run capability

**Tasks:**
1. ✅ Refactor existing Twitter analysis into `/analyze/twitter`
2. ✅ Add filtering support (runId, articleIds, categories)
3. ✅ Build `loadLiveDataToStaging()` helper for re-analysis
4. ✅ Test re-analysis flow: load live → analyze → promote

**Success Criteria:**
- ✅ Can re-run Twitter analysis on existing political articles
- ✅ Can analyze a single article by ID
- ✅ Can analyze all articles from a specific run

**Completion Date:** February 28, 2026

---

### Phase 3: Conversational Interface (Week 3-4)
**Goal:** Skippy can trigger pipelines via natural language

**Tasks:**
1. Build `lib/conversational/pipeline-intent.ts`
2. Add intent patterns:
   - "pull new {category} articles"
   - "re-run {analysis} on {category}"
   - "pull news about {keywords}"
   - "refresh {category}"
3. Wire into Skippy's main agent loop
4. Add confirmation responses

**Success Criteria:**
- Skip says "pull new tech articles" → pipeline runs
- Skip says "re-run sentiment on politics" → re-analysis runs
- Skip says "search for news about Ukraine" → keyword search runs

---

### Phase 4: Reddit Analysis (FUTURE - Week 4-5)
**Goal:** Add Reddit as second social data source

**Tasks:**
1. Build `/analyze/reddit`
2. Reddit API integration (search, classify by subreddit)
3. Add to orchestrator flow
4. Update conversational layer to support "re-run Reddit on..."

---

### Phase 5: AI Sentiment Analysis (FUTURE - Week 5-6)
**Goal:** AI verification of leanings + summaries

**Tasks:**
1. Build `/analyze/sentiment`
2. LLM-based leaning verification
3. LLM-based summary generation
4. Add to orchestrator flow

---

## 🧪 Testing Strategy

### Unit Tests
- `parseIntent()` - Test all conversational patterns
- `deduplication.ts` - Test dedup on sample data
- `loadLiveDataToStaging()` - Test re-analysis data copy

### Integration Tests
1. **Full refresh:** Trigger `/orchestrate` with `runType: "full_refresh"`
2. **Category refresh:** Trigger with `categories: ["technology"]`
3. **Keyword search:** Trigger with `keywords: "climate change"`
4. **Re-analysis:** Load live politics → re-run sentiment → verify updates
5. **Conversational:** Test all intent patterns via Skippy

### Manual Validation
- Compare old monolithic job output with new modular output (should be identical)
- Test partial promotion (update tech, leave politics untouched)
- Test concurrent run prevention (try to trigger two runs simultaneously)

---

## 📊 Timeline Estimate

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **Phase 1:** Modular Foundation | 7-10 days | All core API endpoints working |
| **Phase 2:** Twitter + Re-Analysis | 5-7 days | Full re-analysis capability |
| **Phase 3:** Conversational Layer | 4-5 days | Skippy responds to commands |
| **Phase 4:** Reddit Analysis | 4-5 days | Reddit integration (FUTURE) |
| **Phase 5:** AI Sentiment | 3-4 days | AI analysis (FUTURE) |

**Total for v1.0 (Phases 1-3):** ~3-4 weeks  
**Total for v2.0 (Add Reddit + AI):** ~5-6 weeks

---

## 🍺 Key Architectural Decisions

### 1. Every Stage is Independently Callable
- Can run `/analyze/twitter` on any article set (staging or live)
- Can run `/promote/categories` to update specific categories
- Can chain stages in any order via `/orchestrate`

### 2. Flexible Filtering on All Endpoints
- Filter by `runId` (analyze staging data from a specific run)
- Filter by `articleIds` (analyze specific live articles)
- Filter by `categories` (analyze all articles in a category)

### 3. Re-Analysis via Staging Copy
- Load live data → staging
- Run analysis on staging
- Promote updated results
- Preserves audit trail (new `run_id` for each re-analysis)

### 4. Conversational Layer is Optional
- Can use the pipeline entirely via API (manual triggers, external cron)
- Conversational layer is a convenience wrapper for Skippy
- Intent parsing is extensible (easy to add new patterns)

### 5. Partial Promotion Supported
- Can update just one category without touching others
- Uses UPSERT pattern (no delete, no data loss risk)
- Enables "refresh tech section" without full site rebuild

---

## 🚨 Critical Success Factors

1. ✅ **Every endpoint completes in <60s** (Vercel timeout)
2. ✅ **Idempotent operations** (safe to re-run)
3. ✅ **Run-level locking** (no concurrent corruption)
4. ✅ **Atomic promotion** (UPSERT, no delete→insert)
5. ✅ **Clear audit trail** (`trigger_source`, `trigger_context` tracking)
6. ✅ **Graceful degradation** (if Twitter fails, others continue)

---

## 📝 Future Enhancements

### v3.0 Ideas
- **Multi-source aggregation:** Combine Twitter + Reddit posts into unified viewpoints
- **Trend detection:** "Politics sentiment shifting left over past 3 days"
- **Auto-refresh triggers:** "Iran conflict detected in breaking news → auto-pull related stories"
- **Custom analysis plugins:** Skip can define new analysis types without code changes
- **Scheduled partial refreshes:** "Update tech category every 2 hours, others daily"

---

**This plan enables Skip to control the entire OmniDoxa pipeline conversationally, with full modularity and future-proofing for additional analysis types.**
