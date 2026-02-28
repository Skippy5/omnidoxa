# OmniDoxa Pipeline Functions for Skippy

**Purpose:** Claude function calling definitions for conversational OmniDoxa pipeline control

**Created:** 2026-02-28  
**Status:** Active

---

## Overview

These function definitions enable Skippy (the main OpenClaw agent) to trigger OmniDoxa pipeline operations via natural language commands using Claude's function calling capability.

**Flow:**
```
User: "Pull fresh tech articles"
  ↓
Claude: Detects intent, calls omnidoxa_refresh_categories({ categories: ["technology"] })
  ↓
Handler: Sends POST to /api/pipeline/run with operation params
  ↓
Skippy: Returns user-friendly response ("✅ Fetching fresh technology articles...")
```

---

## Function Definitions

### 1. omnidoxa_refresh_categories

**Purpose:** Fetch fresh news articles for specific categories and run Twitter analysis

**When to use:** User asks to "pull", "fetch", "refresh", or "update" news for a category

**Definition:**
```json
{
  "name": "omnidoxa_refresh_categories",
  "description": "Fetch fresh news articles for specific categories and run Twitter analysis. Use when user asks to 'pull', 'fetch', 'refresh', or 'update' news for a category.",
  "parameters": {
    "type": "object",
    "properties": {
      "categories": {
        "type": "array",
        "items": { 
          "type": "string",
          "enum": [
            "breaking",
            "business", 
            "crime",
            "entertainment",
            "politics",
            "science",
            "top",
            "world",
            "technology",
            "domestic"
          ]
        },
        "description": "News categories to refresh"
      },
      "articlesPerCategory": {
        "type": "number",
        "default": 5,
        "description": "Number of articles to fetch per category (default: 5)"
      }
    },
    "required": ["categories"]
  }
}
```

**Example calls:**
- `omnidoxa_refresh_categories({ categories: ["technology"] })`
- `omnidoxa_refresh_categories({ categories: ["politics", "business"], articlesPerCategory: 10 })`
- `omnidoxa_refresh_categories({ categories: ["breaking", "world", "domestic"] })`

---

### 2. omnidoxa_search_news

**Purpose:** Search for news articles by keywords or topic

**When to use:** User wants breaking news or specific events (e.g., "US Iran bombing", "climate change", "AI regulation")

**Definition:**
```json
{
  "name": "omnidoxa_search_news",
  "description": "Search for news articles by keywords or topic (e.g., 'US Iran bombing', 'climate change', 'AI regulation'). Use for breaking news or specific events.",
  "parameters": {
    "type": "object",
    "properties": {
      "keywords": {
        "type": "string",
        "description": "Search keywords or topic"
      },
      "maxArticles": {
        "type": "number",
        "default": 10,
        "description": "Maximum articles to fetch (default: 10)"
      }
    },
    "required": ["keywords"]
  }
}
```

**Example calls:**
- `omnidoxa_search_news({ keywords: "Ukraine conflict" })`
- `omnidoxa_search_news({ keywords: "AI regulation", maxArticles: 20 })`
- `omnidoxa_search_news({ keywords: "climate summit 2026" })`

---

### 3. omnidoxa_reanalyze_category

**Purpose:** Re-run analysis (Twitter, Reddit, AI sentiment) on existing articles in a category

**When to use:** User wants to "re-run", "update analysis", or "refresh sentiment" on existing data

**Definition:**
```json
{
  "name": "omnidoxa_reanalyze_category",
  "description": "Re-run analysis (Twitter, Reddit, AI sentiment) on existing articles in a category. Use when user wants to 're-run', 'update analysis', or 'refresh sentiment' on existing data.",
  "parameters": {
    "type": "object",
    "properties": {
      "category": {
        "type": "string",
        "enum": [
          "breaking",
          "business",
          "crime",
          "entertainment",
          "politics",
          "science",
          "top",
          "world",
          "technology",
          "domestic"
        ],
        "description": "Category to re-analyze"
      },
      "analysisTypes": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["twitter", "reddit", "ai_sentiment"]
        },
        "description": "Types of analysis to run (default: twitter only)",
        "default": ["twitter"]
      }
    },
    "required": ["category"]
  }
}
```

**Example calls:**
- `omnidoxa_reanalyze_category({ category: "politics" })`
- `omnidoxa_reanalyze_category({ category: "technology", analysisTypes: ["twitter", "ai_sentiment"] })`
- `omnidoxa_reanalyze_category({ category: "breaking", analysisTypes: ["reddit"] })`

---

### 4. omnidoxa_get_status

**Purpose:** Check status of a running OmniDoxa pipeline operation

**When to use:** User asks "how's the pipeline?", "check status", or wants progress updates

**Definition:**
```json
{
  "name": "omnidoxa_get_status",
  "description": "Check status of a running OmniDoxa pipeline operation",
  "parameters": {
    "type": "object",
    "properties": {
      "runId": {
        "type": "number",
        "description": "Run ID to check (optional - if omitted, gets latest run)"
      }
    }
  }
}
```

**Example calls:**
- `omnidoxa_get_status({})` (gets latest run)
- `omnidoxa_get_status({ runId: 42 })`
- `omnidoxa_get_status({ runId: 137 })`

---

## Implementation Notes

**Handler location:** `~/Projects/omnidoxa/src/lib/skippy/function-handler.ts`

**API endpoint:** `POST /api/pipeline/run`

**Response format:**
```typescript
{
  success: boolean;
  message: string;  // User-friendly message
  data?: any;       // API response data
  error?: string;   // Error details (if failed)
}
```

**Trigger context tracking:**
All function calls include metadata for pipeline analytics:
```json
{
  "trigger_source": "conversational",
  "trigger_context": {
    "user_request": "original user message",
    "function_call": "omnidoxa_refresh_categories",
    "function_params": { "categories": ["technology"] }
  }
}
```

---

## User Experience Examples

**Example 1: Quick refresh**
```
User: "Pull fresh tech articles"
Skippy: "✅ Fetching fresh technology articles now. Run ID: 42. Should take ~60s."
```

**Example 2: Multi-category**
```
User: "Update politics and business news"
Skippy: "✅ Fetching fresh politics, business articles now. Run ID: 43. Should take ~90s."
```

**Example 3: Search**
```
User: "Find news about the Ukraine conflict"
Skippy: "🔍 Searching for news about 'Ukraine conflict'... Run ID: 44. I'll let you know what I find!"
```

**Example 4: Re-analysis**
```
User: "Re-run sentiment analysis on breaking news"
Skippy: "🔄 Re-running AI sentiment analysis on breaking articles. 8 articles will be updated."
```

**Example 5: Status check**
```
User: "How's that pipeline run going?"
Skippy: "🔄 Run #42: analyzing
Stage: Twitter Analysis
Progress: 67%"
```

---

## Category Reference

**Available categories:**
- `breaking` - Breaking news
- `business` - Business & finance
- `crime` - Crime & justice
- `entertainment` - Entertainment & culture
- `politics` - Political news
- `science` - Science & technology research
- `top` - Top headlines
- `world` - International news
- `technology` - Tech industry news
- `domestic` - US domestic news

**Analysis types:**
- `twitter` - Twitter/X sentiment analysis (default)
- `reddit` - Reddit discussion analysis
- `ai_sentiment` - AI-powered sentiment analysis

---

## Error Handling

**Failed API calls:**
```
Skippy: "❌ Failed to refresh technology: API unavailable"
```

**Invalid parameters:**
```
Skippy: "❌ Unknown function: omnidoxa_invalid_function"
```

**Network errors:**
```
Skippy: "❌ Failed to trigger pipeline: fetch failed"
```

All errors return user-friendly messages (no stack traces or technical jargon).

---

## Next Steps

1. ✅ Function definitions documented (this file)
2. ⏭️ Create handler module (`function-handler.ts`)
3. ⏭️ Create integration guide (`skippy-integration.md`)
4. ⏭️ Add functions to Skippy's tool configuration
5. ⏭️ Test conversational triggers

---

**Last updated:** 2026-02-28  
**Status:** Complete
