# Omnidoxa Pipeline Redesign — Phased Implementation Plan

## Context & Current State

**Stack:** Next.js 16 (React 19), Turso (libSQL), Vercel, xAI Grok Responses API, Newsdata.io  
**Current flow:** Single monolithic cron job at 5:00 AM that fetches, deduplicates, analyzes, and saves — all in one pass. Tightly coupled, no retry capability, and vulnerable to partial failures and Vercel's timeout limits.

**Core problems this redesign solves:**
1. Tight coupling — fetch and analysis are inseparable; a failure in analysis blocks everything downstream.
2. No validation loop — if dedup reduces a category below 5 articles, there's no re-pull mechanism.
3. All-or-nothing — partial failures leave inconsistent data in the live tables.
4. Vercel timeout risk — 10-15 minute runtime against a 5-minute function timeout.
5. No modularity — can't add Reddit analysis, re-run sentiment, or retry Twitter analysis independently.

---

## Architecture Principles for Redesign

1. **Keep the existing stack.** Turso, Vercel, Next.js, xAI — no platform migration needed.
2. **Break the monolith into chained API route jobs.** Each stage is its own `/api/pipeline/...` endpoint, callable independently or chained by an orchestrator. This also solves the Vercel timeout problem — each function stays well under 5 minutes.
3. **Staging tables in Turso sit alongside your existing live tables.** Prefix with `staging_`. Promotion is an atomic operation that overwrites the live `stories`, `viewpoints`, and `social_posts` tables.
4. **Each stage is idempotent.** Re-running a stage for a given `run_id` picks up where it left off without creating duplicates.
5. **The orchestrator is a lightweight coordinator** — it calls stage endpoints sequentially and checks status between calls. It can be a single API route that loops, or an external cron/webhook chain.

---

## Revised Database Schema

### New Staging Tables (add to existing Turso DB alongside live tables)

```sql
-- Tracks each pipeline run
CREATE TABLE pipeline_runs (
  id TEXT PRIMARY KEY,                    -- UUID
  started_at TEXT NOT NULL,               -- ISO timestamp
  status TEXT NOT NULL DEFAULT 'started', -- started | ingesting | deduplicating | analyzing | promoting | complete | failed
  current_stage TEXT,                     -- which stage is active
  error_message TEXT,
  completed_at TEXT,
  config TEXT                             -- JSON: categories list, target counts, etc.
);

-- Per-category tracking within a run
CREATE TABLE category_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES pipeline_runs(id),
  category TEXT NOT NULL,
  target_count INTEGER NOT NULL DEFAULT 5,
  raw_count INTEGER DEFAULT 0,           -- articles pulled before dedup
  deduped_count INTEGER DEFAULT 0,       -- articles surviving dedup
  selected_count INTEGER DEFAULT 0,      -- final articles chosen
  pull_attempts INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | ingested | deduped | needs_repull | ready | analyzing | complete
  updated_at TEXT,
  UNIQUE(run_id, category)
);

-- Staging area for articles before promotion
CREATE TABLE staging_articles (
  id TEXT PRIMARY KEY,                    -- UUID
  run_id TEXT NOT NULL REFERENCES pipeline_runs(id),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  title_normalized TEXT,                  -- lowercase, stripped punctuation
  description TEXT,
  url TEXT NOT NULL,
  url_normalized TEXT,                    -- stripped tracking params
  content_hash TEXT,                      -- SHA-256 of title+description for fuzzy dedup
  source TEXT,
  image_url TEXT,
  published_at TEXT,
  fetched_at TEXT,
  pull_batch INTEGER DEFAULT 1,
  ingestion_status TEXT DEFAULT 'raw',    -- raw | deduplicated | selected | rejected
  rejection_reason TEXT,                  -- null, 'duplicate_url', 'duplicate_content', 'fuzzy_title_match', 'surplus'
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_staging_articles_run_cat ON staging_articles(run_id, category);
CREATE INDEX idx_staging_articles_status ON staging_articles(run_id, ingestion_status);
CREATE INDEX idx_staging_articles_url ON staging_articles(url_normalized);

-- Tracks each analysis job (Twitter, Reddit, AI sentiment, etc.)
CREATE TABLE analysis_jobs (
  id TEXT PRIMARY KEY,                    -- UUID
  run_id TEXT NOT NULL REFERENCES pipeline_runs(id),
  article_id TEXT NOT NULL REFERENCES staging_articles(id),
  job_type TEXT NOT NULL,                 -- 'twitter' | 'reddit' | 'ai_sentiment' | 'summary'
  status TEXT DEFAULT 'pending',          -- pending | running | complete | failed | skipped
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX idx_analysis_jobs_run ON analysis_jobs(run_id, job_type, status);

-- Staging viewpoints (mirrors live viewpoints table)
CREATE TABLE staging_viewpoints (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES pipeline_runs(id),
  article_id TEXT NOT NULL REFERENCES staging_articles(id),
  lean TEXT NOT NULL,                     -- 'left' | 'center' | 'right'
  summary TEXT,
  sentiment_score REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Staging social posts (mirrors live social_posts table)
CREATE TABLE staging_social_posts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES pipeline_runs(id),
  viewpoint_id TEXT NOT NULL REFERENCES staging_viewpoints(id),
  article_id TEXT NOT NULL,               -- denormalized for easier queries
  author TEXT,
  content TEXT,
  source TEXT DEFAULT 'twitter',          -- 'twitter' | 'reddit'
  url TEXT,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  timestamp TEXT,
  is_real INTEGER DEFAULT 1,              -- 1 = real from xAI/API, 0 = fallback
  political_leaning_target TEXT,          -- what we searched for
  political_leaning_verified TEXT,        -- what AI confirmed (Phase 5)
  sentiment_score REAL,                   -- per-post sentiment (Phase 5)
  sentiment_label TEXT,                   -- positive | negative | neutral | mixed (Phase 5)
  created_at TEXT DEFAULT (datetime('now'))
);
```

### Live Tables — No Changes Needed Yet
Your existing `stories`, `viewpoints`, and `social_posts` tables stay exactly as they are. The promotion step in Phase 6 will copy from staging to live. When you add Reddit and AI sentiment later, you'll add columns to the live tables at that point.

---

## File Structure (New & Modified Files)

```
src/
├── app/api/
│   ├── news/
│   │   └── fetch/route.ts           # EXISTING — will become legacy, eventually replaced
│   └── pipeline/                     # NEW — all pipeline stages as API routes
│       ├── orchestrate/route.ts      # Master coordinator — calls stages in sequence
│       ├── ingest/route.ts           # Stage 1: Pull articles → staging
│       ├── deduplicate/route.ts      # Stage 2: Dedup + validate + repull loop
│       ├── analyze/
│       │   ├── twitter/route.ts      # Stage 3: Twitter/X analysis via xAI
│       │   ├── reddit/route.ts       # Stage 4: Reddit analysis (future)
│       │   └── sentiment/route.ts    # Stage 5: AI sentiment verification (future)
│       ├── promote/route.ts          # Stage 6: Staging → Live atomic copy
│       └── status/route.ts           # Utility: Check run status, debug
├── lib/
│   ├── pipeline/                     # NEW — pipeline business logic
│   │   ├── orchestrator.ts           # Run management, stage sequencing
│   │   ├── ingestion.ts              # Newsdata.io fetching logic
│   │   ├── deduplication.ts          # URL, hash, and fuzzy title dedup
│   │   ├── validation.ts             # Count checks, repull decisions
│   │   ├── promotion.ts              # Staging → Live copy logic
│   │   └── analysis/
│   │       ├── job-runner.ts         # Generic job dispatcher with retry logic
│   │       ├── twitter.ts            # xAI Grok analysis (refactored from existing)
│   │       ├── reddit.ts             # Reddit analysis (future)
│   │       └── ai-sentiment.ts       # LLM sentiment scoring (future)
│   ├── db-cloud.ts                   # EXISTING — add staging table helpers
│   ├── db-staging.ts                 # NEW — all staging CRUD operations
│   ├── convert-with-twitter-pipeline.ts  # EXISTING — will be refactored, not deleted
│   └── utils/
│       ├── text-processing.ts        # NEW — title normalization, URL normalization, hashing
│       └── rate-limiter.ts           # NEW — centralized rate limit management
```

---

## Phase 1: Foundation — Staging DB, Orchestrator, Article Ingestion

**Goal:** Articles land reliably in a staging database with full tracking. Nothing touches the live tables. Your existing cron job continues running as-is during development — the new pipeline runs in parallel until you're ready to switch over.

### Step 1.1: Create Staging Tables in Turso
- Run the schema SQL above against your Turso database.
- Keep all existing tables untouched.
- Add a `db-staging.ts` module with typed helper functions:
  - `createPipelineRun(config)` → returns `run_id`
  - `updateRunStatus(runId, status)`
  - `initCategoryStatus(runId, categories[])` — inserts a row per category
  - `updateCategoryStatus(runId, category, updates)`
  - `insertStagingArticle(article)` / `bulkInsertStagingArticles(articles[])`
  - `getStagingArticles(runId, category, status?)` — query with filters
  - `updateArticleStatus(articleId, status, rejectionReason?)`

### Step 1.2: Build Text Processing Utilities
Create `lib/utils/text-processing.ts`:
- `normalizeUrl(url)` — strip UTM params, trailing slashes, `www.`, force lowercase hostname. This is critical for dedup. Port over any normalization logic from your existing dedup code.
- `normalizeTitle(title)` — lowercase, strip punctuation, collapse whitespace.
- `contentHash(title, description)` — SHA-256 of normalized title + normalized description. Used for catching same-story-different-URL duplicates.

### Step 1.3: Build the Ingestion Module
Create `lib/pipeline/ingestion.ts`:
- `async function pullArticlesForCategory(runId: string, category: string, batchNumber: number = 1, count: number = 50)`
  - Calls Newsdata.io API (reuse your existing fetch logic from the current pipeline).
  - For each article returned:
    - Compute `url_normalized`, `title_normalized`, `content_hash`.
    - Insert into `staging_articles` with `ingestion_status = 'raw'` and `pull_batch = batchNumber`.
  - Update `category_status.raw_count` and `category_status.pull_attempts`.
  - Wrap in try/catch — if the API call fails for one category, log the error, mark category as failed, continue to the next category. **Do not crash the whole run.**
- `async function pullAllCategories(runId: string)`
  - Iterate through all 10 categories.
  - Call `pullArticlesForCategory` for each with a delay between calls (reuse your existing 5-second inter-category delay).
  - Update `pipeline_runs.status = 'ingesting'` at start.

### Step 1.4: Build the Orchestrator Shell
Create `lib/pipeline/orchestrator.ts`:
- `async function startRun()` → creates `pipeline_runs` record, inits `category_status` for all 10 categories, returns `runId`.
- `async function getRunStatus(runId)` → returns run info + all category statuses.
- For now, only wires up ingestion. Later phases add more stages.

### Step 1.5: Create the API Routes
- `POST /api/pipeline/orchestrate` — starts a full pipeline run. For now, just calls ingestion.
- `POST /api/pipeline/ingest` — accepts `{ runId }`, runs ingestion only. Useful for manual triggers and testing.
- `GET /api/pipeline/status?runId=xxx` — returns full run status with per-category breakdown.

### Step 1.6: Keep Existing Cron Running
- Do NOT disable the existing `GET /api/news/fetch?refresh=true` cron job.
- The new pipeline runs independently. You'll switch over in Phase 6 once promotion is working.

### Phase 1 Testing
- Trigger `POST /api/pipeline/orchestrate` manually (via curl, Postman, or a temp button in your admin UI).
- Check Turso: `pipeline_runs` should have a row. `category_status` should show 10 rows. `staging_articles` should have ~500 rows (50 × 10).
- Check `GET /api/pipeline/status` returns coherent data.
- Run it twice — confirm second run creates a separate `run_id` with its own articles, no interference.

---

## Phase 2: Deduplication & Validation Loop

**Goal:** Deduplicate articles within each category (and globally across categories), validate 5 per category, re-pull if short.

### Step 2.1: Build the Deduplication Module
Create `lib/pipeline/deduplication.ts`:
- `async function deduplicateCategory(runId: string, category: string)`
  - Query all `staging_articles` for this run + category where `ingestion_status = 'raw'`.
  - **Layer 1 — Exact URL:** Group by `url_normalized`. For duplicates, keep the first, mark others as `rejected` with `rejection_reason = 'duplicate_url'`.
  - **Layer 2 — Content hash:** Group by `content_hash`. For duplicates, keep the one from the better source (define a source priority list in config, e.g., Reuters > AP > CNN > ...). Mark others as `rejected` with `rejection_reason = 'duplicate_content'`.
  - **Layer 3 — Fuzzy title match:** Compare `title_normalized` values. Use a simple approach first: split into word sets and check Jaccard similarity > 0.75 (or use a lightweight string distance lib). Mark lower-priority duplicates as `rejected` with `rejection_reason = 'fuzzy_title_match'`.
  - **Layer 4 — Cross-category global dedup:** Check if any surviving article's `url_normalized` or `content_hash` already exists in `staging_articles` for a DIFFERENT category in the same run (where that other article is `deduplicated` or `selected`). If so, reject the duplicate in the current category. This preserves your existing global dedup behavior.
  - Mark all surviving articles as `ingestion_status = 'deduplicated'`.
  - Update `category_status.deduped_count`.

- `async function selectTopArticles(runId: string, category: string, targetCount: number = 5)`
  - From `deduplicated` articles, rank by: recency (`published_at` DESC), source quality, content length/richness.
  - Mark top N as `selected`. Mark the rest as `rejected` with `rejection_reason = 'surplus'`.
  - Update `category_status.selected_count`.

### Step 2.2: Build the Validation & Re-Pull Loop
Create `lib/pipeline/validation.ts`:
- `async function validateAndRepull(runId: string, maxRepullAttempts: number = 2)`
  - After dedup + selection runs for all categories, check each `category_status`:
    - If `selected_count >= target_count` → update status to `ready`.
    - If `selected_count < target_count` AND `pull_attempts < maxRepullAttempts`:
      - Update status to `needs_repull`.
      - Call `pullArticlesForCategory(runId, category, batchNumber: pull_attempts + 1)` — consider tweaking search query (broader date range, alternate keywords) on repull.
      - Run `deduplicateCategory` again — **important:** dedup the new batch against ALL existing articles for this category+run (not just the new batch). This means the dedup function must look at all articles regardless of `pull_batch`.
      - Run `selectTopArticles` again — reconsider from the full pool of deduplicated articles.
      - Re-check count.
    - If still short after max attempts → update status to `ready` anyway (proceed with what we have), but log a warning in `category_status` or `pipeline_runs.config` JSON.
  - When all categories are `ready`, update `pipeline_runs.status = 'ingestion_complete'`.

### Step 2.3: Create the API Route
- `POST /api/pipeline/deduplicate` — accepts `{ runId }`, runs dedup + validation loop for all categories.
- Wire into orchestrator: after ingestion completes, orchestrator calls dedup endpoint.

### Step 2.4: Update Orchestrator Flow
```
orchestrator.startRun()
  → ingest all categories
  → deduplicate + validate (with repull loop)
  → mark run as 'ingestion_complete'
  → (future phases continue from here)
```

### Phase 2 Testing
- Trigger a run. After completion, query `staging_articles` grouped by category and `ingestion_status`:
  - Each category should have exactly 5 `selected` articles (or close to it with a logged warning).
  - `rejected` articles should have meaningful `rejection_reason` values.
- Manually insert a duplicate URL across two categories in staging, re-run dedup, confirm it gets caught by cross-category dedup.
- Confirm that a re-pull actually fires by temporarily setting `target_count = 50` (impossible to meet) and watching `pull_attempts` increment.

---

## Phase 3: Twitter/X Analysis Module (Refactored)

**Goal:** Decouple Twitter analysis from ingestion. Refactor your existing `convertToStoryWithTwitterPipeline()` and `analyzeWithGrokResponses()` into a standalone module that operates on staged articles.

### Step 3.1: Refactor Existing Twitter Analysis
Create `lib/pipeline/analysis/twitter.ts` by extracting and adapting from `convert-with-twitter-pipeline.ts`:
- `async function analyzeArticleTwitter(runId: string, articleId: string)`
  - Read the staged article from `staging_articles`.
  - Call your existing xAI Grok Responses API logic (with `x_search` + `web_search`) — this is the core of `analyzeWithGrokResponses()`, just refactored to:
    - Read from `staging_articles` instead of an in-memory article object.
    - Write viewpoints to `staging_viewpoints` instead of live `viewpoints`.
    - Write social posts to `staging_social_posts` instead of live `social_posts`.
  - Create/update an `analysis_jobs` record tracking status.
  - Preserve your existing fallback behavior (if xAI fails, mark `is_real = 0` and store fallback message).
  - Preserve your existing rate limiting (2-second delay between articles).

**Key point:** You are NOT rewriting the xAI analysis logic. You're extracting it from the monolithic pipeline into a function that reads from staging and writes to staging. The prompt engineering, the Grok API calls, the tweet extraction — all of that stays the same.

### Step 3.2: Build the Generic Job Runner
Create `lib/pipeline/analysis/job-runner.ts`:
- `async function runAnalysisJobs(runId: string, jobType: string)`
  - Query all `staging_articles` where `ingestion_status = 'selected'` for this run.
  - For each article, check if an `analysis_jobs` record already exists for this `jobType`:
    - If no record → create one with `status = 'pending'`.
    - If record exists with `status = 'complete'` → skip (idempotent).
    - If record exists with `status = 'failed'` and `attempt_count < max_attempts` → retry.
  - Process pending/retryable jobs sequentially (respecting rate limits).
  - For each job: update status to `running`, call the appropriate analysis function, update to `complete` or `failed`.
  - Return a summary: `{ total, completed, failed, skipped }`.

- The runner dispatches based on `jobType`:
  ```typescript
  const analyzers: Record<string, AnalyzerFn> = {
    twitter: analyzeArticleTwitter,
    // reddit: analyzeArticleReddit,      // Phase 4
    // ai_sentiment: analyzeArticleSentiment, // Phase 5
  };
  ```

### Step 3.3: Create the API Route
- `POST /api/pipeline/analyze/twitter` — accepts `{ runId }`, runs Twitter analysis for all selected articles in the run.
- This route should be callable independently — meaning you can re-run Twitter analysis on an existing run without re-fetching articles.

### Step 3.4: Update Orchestrator
```
orchestrator.startRun()
  → ingest all categories
  → deduplicate + validate
  → run Twitter analysis jobs
  → mark run as 'analysis_complete'
```

### Step 3.5: Handle Vercel Timeouts
Each analysis route processes articles sequentially. If you have 50 articles at ~2 seconds each for the xAI call, that's ~100 seconds plus overhead — should fit within Vercel's 5-minute limit. But if it gets close:
- Option A: Process in batches of 10-15 articles per function invocation. The orchestrator calls the endpoint multiple times, each time it picks up unprocessed articles.
- Option B: Use Vercel's `waitUntil()` for background processing if available in your plan.
- The job runner's idempotent design (skip already-completed jobs) makes batching safe — just call the endpoint again and it picks up where it left off.

### Phase 3 Testing
- Run a full pipeline through ingestion + dedup + Twitter analysis.
- Compare output quality against your current monolithic job — viewpoints and social posts should be equivalent.
- Kill the analysis midway (cancel the request). Call the endpoint again. Confirm it skips already-analyzed articles and picks up the rest.
- Check `analysis_jobs` table for a complete audit trail.

---

## Phase 4: Reddit Analysis Module (New Capability)

**Goal:** Add Reddit post/comment collection for each staged article as a new, independent analysis module.

### Step 4.1: Build the Reddit Analysis Module
Create `lib/pipeline/analysis/reddit.ts`:
- `async function analyzeArticleReddit(runId: string, articleId: string)`
  - Read the staged article.
  - Search Reddit's API for posts linking to or discussing this article:
    - Search by article URL.
    - Search by article title keywords.
    - Search in relevant subreddits for the article's category.
  - For each post found:
    - Determine subreddit and estimate political leaning from a config mapping:
      ```typescript
      const subredditLeanings: Record<string, string> = {
        'politics': 'left',
        'liberal': 'left',
        'progressive': 'left',
        'conservative': 'right',
        'republican': 'right',
        'libertarian': 'right',
        'neutralnews': 'center',
        'moderatepolitics': 'center',
        'centrist': 'center',
        // ... etc
      };
      ```
    - Fetch top N comments (sorted by score).
    - Write to `staging_social_posts` with `source = 'reddit'` and `political_leaning_target` based on subreddit mapping.
  - Handle Reddit API rate limits (respect their 60 requests/minute guideline).
  - Fallback: If no Reddit discussion is found, mark the analysis job as `complete` with an empty result (don't fail the job).

### Step 4.2: Add Reddit Schema Support
Add columns to `staging_social_posts` if not already flexible enough:
- The existing schema already has `source TEXT` which can be `'reddit'`.
- You may want to add a `subreddit TEXT` column, or store it in a JSON metadata column.
- For top comments, consider a `staging_social_post_comments` table or store as JSON in a `metadata` column on the post.

### Step 4.3: Register With Job Runner
- Add `'reddit': analyzeArticleReddit` to the job runner's analyzer map.
- Create API route: `POST /api/pipeline/analyze/reddit` — accepts `{ runId }`.

### Step 4.4: Update Orchestrator
Twitter and Reddit analysis can run sequentially (simpler) or in parallel (faster but more complex). Start with sequential:
```
orchestrator.startRun()
  → ingest → deduplicate → validate
  → run Twitter analysis
  → run Reddit analysis
  → mark 'analysis_complete'
```

### Phase 4 Testing
- Run pipeline and verify Reddit posts appear in `staging_social_posts` with `source = 'reddit'`.
- Check that subreddit-based leaning classification is applied.
- Verify articles with no Reddit discussion don't cause failures.

---

## Phase 5: AI Sentiment Analysis & Leaning Verification

**Goal:** Use an LLM (xAI Grok or another model) to verify political leanings of collected posts, score sentiment, and generate per-leaning narrative summaries.

### Step 5.1: Build the AI Sentiment Module
Create `lib/pipeline/analysis/ai-sentiment.ts`:

- `async function verifyPostLeaning(postContent: string, claimedLeaning: string): Promise<string>`
  - Send post content to xAI Grok (or another LLM) with a classification prompt.
  - Returns verified leaning: `'left' | 'center' | 'right' | 'unclear'`.
  - Update `political_leaning_verified` on the post record.

- `async function scorePostSentiment(postContent: string, articleTitle: string): Promise<{ score: number, label: string }>`
  - Ask the LLM to rate sentiment toward the article topic (-1.0 to 1.0) and assign a label.
  - Update `sentiment_score` and `sentiment_label` on the post record.

- `async function generateLeaningSummary(runId: string, articleId: string, leaning: string): Promise<string>`
  - Gather all verified posts (Twitter + Reddit) for this article where `political_leaning_verified = leaning`.
  - Send to LLM: "Here are social media posts about [article title] from [leaning]-leaning sources. Summarize the overall sentiment, key arguments, and tone from this political perspective in 2-3 paragraphs."
  - Write/update the corresponding `staging_viewpoints` record's `summary` field.
  - Optionally update `sentiment_score` on the viewpoint to be the average of its posts' scores.

- **Batch for efficiency:** Group multiple posts into single LLM calls where possible. For example, send 10 posts at once for leaning verification rather than 10 separate API calls.

### Step 5.2: Wire the Analysis Flow
For each article:
1. Verify leanings of all associated Twitter + Reddit posts.
2. Score sentiment of all posts.
3. Generate 3 leaning summaries (left, center, right) — these either update or replace the summaries that xAI generated in Phase 3.

### Step 5.3: Register & Route
- Add `'ai_sentiment'` and `'summary'` job types to the runner.
- Create route: `POST /api/pipeline/analyze/sentiment` — accepts `{ runId }`.
- This MUST run after Twitter and Reddit analysis are complete (the orchestrator enforces ordering).

### Step 5.4: Update Orchestrator Ordering
```
orchestrator.startRun()
  → ingest → deduplicate → validate
  → Twitter analysis
  → Reddit analysis
  → AI sentiment verification + scoring + summaries  ← depends on Twitter & Reddit
  → mark 'analysis_complete'
```

### Phase 5 Testing
- Verify `political_leaning_verified` is populated and sometimes differs from `political_leaning_target` (proving the verification is doing real work).
- Compare AI-generated leaning summaries against the original xAI summaries — they should be richer since they incorporate Reddit data too.
- Check that articles with posts only from one or two leanings still generate summaries (with appropriate "limited data" notes).

---

## Phase 6: Promotion to Live & Cutover

**Goal:** Atomically copy validated staging data to the live tables, replacing old data. Then switch the cron job from the old monolithic endpoint to the new pipeline.

### Step 6.1: Build the Promotion Module
Create `lib/pipeline/promotion.ts`:

- `async function validateRunCompleteness(runId: string): Promise<{ valid: boolean, issues: string[] }>`
  - Check every category has `selected_count >= target_count` (or is flagged as best-effort).
  - Check every selected article has a `complete` Twitter analysis job.
  - Check every selected article has viewpoints and social posts in staging.
  - Return a list of issues (if any) — the orchestrator can decide whether to proceed or abort.

- `async function promoteToLive(runId: string)`
  - **This must be as atomic as Turso/libSQL allows.** Execute in a transaction:
    1. For each category being updated:
       - Delete from `social_posts` where the parent `viewpoints.story_id` matches stories in this category.
       - Delete from `viewpoints` where `story_id` matches stories in this category.
       - Delete from `stories` where `category` matches.
    2. Insert into `stories` from `staging_articles` where `ingestion_status = 'selected'` for this run. Map columns: `staging_articles.id → stories.id`, etc.
    3. Insert into `viewpoints` from `staging_viewpoints` for this run. Map `article_id → story_id`.
    4. Insert into `social_posts` from `staging_social_posts` for this run.
    5. Update `pipeline_runs.status = 'promoted'`.
    6. Commit.
  - If any step fails, rollback — live data remains unchanged.
  - **Note on ID mapping:** Your live `stories` table uses `id` as PK. Decide whether staging article IDs become the new live story IDs (simplest) or if you generate new IDs during promotion. Using the staging IDs directly is recommended — it's simpler and makes debugging easier.

- `async function cleanupOldRuns(keepLastN: number = 3)`
  - Delete staging data (articles, viewpoints, posts, analysis jobs, category status) for runs older than the last N completed runs.
  - Don't delete the `pipeline_runs` record itself (keep for audit).

### Step 6.2: Create the API Route
- `POST /api/pipeline/promote` — accepts `{ runId }`, validates and promotes.
- `POST /api/pipeline/cleanup` — runs cleanup of old staging data.

### Step 6.3: Update Orchestrator — Full Flow
```
orchestrator.startRun()
  → ingest all categories
  → deduplicate + validate (with repull loop)
  → run Twitter analysis
  → run Reddit analysis (when ready)
  → run AI sentiment (when ready)
  → validate completeness
  → promote to live
  → cleanup old runs
  → mark run as 'complete'
```

### Step 6.4: Switch the Cron Job
- Update your Vercel cron configuration:
  - **Old:** `GET /api/news/fetch?refresh=true` at 5:00 AM
  - **New:** `POST /api/pipeline/orchestrate` at 5:00 AM
- Keep the old endpoint code around (don't delete it) but stop the cron from calling it.
- Monitor the new pipeline for a few days before removing the old code.

### Phase 6 Testing
- Run full pipeline → promote → check live tables match what was in staging.
- Run the pipeline twice → confirm second promotion cleanly replaces first (no leftover data from previous run).
- Simulate a failure during promotion (e.g., invalid data) → confirm rollback leaves live data untouched.
- Hit the frontend and verify stories, viewpoints, and social posts display correctly with the new pipeline's data.

---

## Phase 7: Hardening & Operational Improvements

### 7.1: Configuration Centralization
Create a `pipeline.config.ts`:
```typescript
export const PIPELINE_CONFIG = {
  categories: ['breaking', 'business', 'crime', 'entertainment', 'politics',
               'science', 'top', 'world', 'technology', 'domestic'],
  articlesPerCategory: 5,
  articlesPerPull: 50,
  maxRepullAttempts: 2,
  delayBetweenArticlesMs: 2000,
  delayBetweenCategoriesMs: 5000,
  twitterPostsPerLeaning: { min: 5, max: 10 },
  analysisMaxRetries: 3,
  sourcePriority: ['reuters', 'ap', 'bbc', ...],  // for dedup tiebreaking
  subredditLeanings: { ... },  // for Reddit classification
};
```

### 7.2: Logging & Monitoring
- Add structured logging to every pipeline module (use a consistent format).
- Create a summary endpoint: `GET /api/pipeline/summary?runId=xxx` that returns:
  - Articles per category (selected vs rejected).
  - Analysis completion rates.
  - Errors encountered.
  - Total runtime.
- Consider writing daily summaries to a `pipeline_logs` table for historical tracking.
- You can repurpose your existing `fetch-logger.ts` for this.

### 7.3: Run Recovery
- `async function resumeRun(runId: string)` in the orchestrator:
  - Check `pipeline_runs.status` and `category_status` to determine the last completed stage.
  - Pick up from the next stage.
  - The idempotent job runner makes this safe — completed jobs are skipped automatically.
- Expose via: `POST /api/pipeline/orchestrate?resume=true&runId=xxx`

### 7.4: Admin UI (Optional but Recommended)
Add a simple admin page (password-protected or behind auth) at `/admin/pipeline`:
- Show recent pipeline runs with status.
- Button to trigger a manual run.
- Button to resume a failed run.
- Per-run drill-down showing category status and analysis job status.
- This will save you a lot of time debugging compared to querying Turso directly.

---

## Implementation Sequence Summary

| Phase | Delivers | Depends On | Estimated Complexity |
|-------|----------|------------|---------------------|
| **1** | Staging DB + tracked ingestion | Nothing | Medium — schema + new modules + API routes |
| **2** | Smart dedup + validation loop | Phase 1 | Medium — dedup logic is the trickiest part |
| **3** | Refactored Twitter analysis (decoupled) | Phase 2 | Medium — mostly refactoring existing code |
| **4** | Reddit analysis | Phase 2 | Medium — new API integration |
| **5** | AI sentiment + leaning verification | Phases 3 & 4 | Medium — LLM prompt engineering |
| **6** | Atomic promotion + cron cutover | Phase 3 (min) | Low-Medium — mostly SQL + transaction logic |
| **7** | Config, logging, recovery, admin UI | All phases | Low — polish work |

**Minimum viable cutover:** Phases 1 + 2 + 3 + 6. This gives you the staged pipeline with the same Twitter analysis you have today, but with reliable dedup, validation, and atomic promotion. Phases 4 and 5 add new analysis capabilities on top.

---

## Notes for the AI Coder

- **Do not delete or modify existing files until Phase 6 cutover.** Build all new code alongside the existing pipeline. The old cron job keeps running until you're confident the new pipeline works.
- **Every database operation on staging tables should include `run_id` in the WHERE clause.** This prevents cross-run contamination and makes cleanup straightforward.
- **All API routes should accept `runId` as a parameter** and operate only on that run's data. The orchestrator is the only thing that creates run IDs.
- **Rate limiting is critical.** The existing 2-second and 5-second delays exist for good reasons. Preserve them, and add similar limits for Reddit and LLM APIs.
- **Test each phase independently before moving on.** The staged design means you can trigger individual endpoints via curl/Postman and inspect the staging tables directly in Turso.
- **TypeScript types matter.** Define interfaces for `StagingArticle`, `AnalysisJob`, `CategoryStatus`, etc. early. They'll prevent bugs when shuffling data between stages.
