# OmniDoxa Conversational Integration - Skippy Setup

**Purpose:** Step-by-step guide for integrating OmniDoxa functions into Skippy's main agent loop

**Created:** 2026-02-28  
**Status:** Active

---

## Overview

This guide shows how to integrate OmniDoxa pipeline functions into Skippy (the main OpenClaw agent) to enable conversational pipeline control via Claude's function calling.

**What it does:**
```
User: "Pull fresh tech articles"
  ↓
Claude: Calls omnidoxa_refresh_categories({ categories: ["technology"] })
  ↓
Handler: Sends POST to OmniDoxa API
  ↓
Skippy: Returns "✅ Fetching fresh technology articles now. Run ID: 42."
```

---

## Prerequisites

- OmniDoxa dev server running (`npm run dev` in `~/Projects/omnidoxa`)
- OpenClaw gateway running (Skippy's main agent environment)
- Environment variable `OMNIDOXA_API_URL` set (default: `http://localhost:3001`)

---

## Step 1: Add Function Definitions

**Location:** Skippy's tool configuration (OpenClaw agent config)

**File:** Check OpenClaw configuration for where tools are defined. Common locations:
- `~/.openclaw/agent-config.json`
- `~/clawd/config/agent-tools.json`
- Or via OpenClaw Dashboard → Agent Config

**Action:** Copy the 4 function definitions from:  
`~/Projects/omnidoxa/docs/skippy-functions.md`

**Paste into tools array:**
```json
{
  "tools": [
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
              "enum": ["breaking", "business", "crime", "entertainment", "politics", "science", "top", "world", "technology", "domestic"]
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
    },
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
    },
    {
      "name": "omnidoxa_reanalyze_category",
      "description": "Re-run analysis (Twitter, Reddit, AI sentiment) on existing articles in a category. Use when user wants to 're-run', 'update analysis', or 'refresh sentiment' on existing data.",
      "parameters": {
        "type": "object",
        "properties": {
          "category": {
            "type": "string",
            "enum": ["breaking", "business", "crime", "entertainment", "politics", "science", "top", "world", "technology", "domestic"],
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
    },
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
  ]
}
```

---

## Step 2: Add Handler Import

**Location:** Skippy's main agent file

**File:** This depends on how OpenClaw is structured. Common possibilities:
- A custom agent handler script
- OpenClaw's function call dispatcher
- A middleware/plugin file

**Action:** Add import at the top of the file:

```typescript
import { handleOmniDoxaFunction } from '~/Projects/omnidoxa/src/lib/skippy/function-handler';
```

**Alternative (if using Node.js require):**
```javascript
const { handleOmniDoxaFunction } = require('~/Projects/omnidoxa/src/lib/skippy/function-handler');
```

---

## Step 3: Add Function Call Handler

**Location:** In Skippy's function calling logic

**Find:** The part of the code that handles Claude's function calls (where other tool handlers are defined)

**Add:** OmniDoxa function handler:

```typescript
// When Claude calls a function
async function handleFunctionCall(functionName: string, params: any, userRequest: string) {
  
  // OmniDoxa functions
  if (functionName.startsWith('omnidoxa_')) {
    const result = await handleOmniDoxaFunction(functionName, params, userRequest);
    return result.message;  // Return user-friendly message to Claude
  }
  
  // ... other function handlers (file_read, exec, web_search, etc.)
  
}
```

**What this does:**
- Intercepts calls to `omnidoxa_*` functions
- Calls the handler with function name, params, and user request
- Returns user-friendly message for Skippy to relay to user

---

## Step 4: Set Environment Variable

**Action:** Set `OMNIDOXA_API_URL` environment variable

**Option 1: Shell export (temporary)**
```bash
export OMNIDOXA_API_URL=http://localhost:3001
```

**Option 2: Add to `.env` file (persistent)**

Create or edit `~/clawd/.env`:
```env
OMNIDOXA_API_URL=http://localhost:3001
```

**Option 3: Add to OpenClaw config**
If OpenClaw supports environment variables in config:
```json
{
  "env": {
    "OMNIDOXA_API_URL": "http://localhost:3001"
  }
}
```

**Note:** If OmniDoxa API is running on a different port or host, update the URL accordingly.

---

## Step 5: Test Conversational Commands

**Start services:**
```bash
# Terminal 1: OmniDoxa dev server
cd ~/Projects/omnidoxa
npm run dev

# Terminal 2: OpenClaw gateway (Skippy)
openclaw gateway start
```

**Test commands:**

**Test 1: Refresh categories**
```
You: "Pull fresh tech articles"
Skippy: "✅ Fetching fresh technology articles now. Run ID: 42. Should take ~60s."
```

**Test 2: Search**
```
You: "Find news about AI regulation"
Skippy: "🔍 Searching for news about 'AI regulation'... Run ID: 43. I'll let you know what I find!"
```

**Test 3: Re-analysis**
```
You: "Re-run sentiment on politics"
Skippy: "🔄 Re-running twitter analysis on politics articles. 12 articles will be updated."
```

**Test 4: Status check**
```
You: "Check pipeline status"
Skippy: "✅ Run #42: complete
Stage: Twitter Analysis
Progress: 100%"
```

**Test 5: Multi-category**
```
You: "Update politics and business news"
Skippy: "✅ Fetching fresh politics and business articles now. Run ID: 44. Should take ~120s."
```

---

## Troubleshooting

### Issue: Function not called

**Symptom:** Skippy doesn't recognize the command

**Diagnosis:**
- Check that function definitions are in tools array
- Verify tool names match exactly (`omnidoxa_refresh_categories` etc.)
- Confirm Claude has access to the tools (check OpenClaw logs)

**Fix:**
1. Verify tools are loaded: Check OpenClaw config or logs
2. Restart gateway: `openclaw gateway restart`
3. Test with explicit function call in Claude interface

---

### Issue: API error

**Symptom:** "❌ Failed to refresh technology: API unavailable"

**Diagnosis:**
- OmniDoxa dev server not running
- Wrong API URL
- Network issue

**Fix:**
```bash
# Check if dev server is running
curl http://localhost:3001/api/health

# Expected response:
# {"status":"ok"}

# If not, start dev server:
cd ~/Projects/omnidoxa
npm run dev
```

**Verify environment variable:**
```bash
echo $OMNIDOXA_API_URL
# Should output: http://localhost:3001
```

---

### Issue: Invalid params

**Symptom:** "❌ Invalid category: tech"

**Diagnosis:** Claude called function with wrong parameter format

**Cause:** Function description might be unclear

**Fix:**
1. Check that category enums are listed in function definition
2. Update description to be more explicit about valid values
3. Example: "Use 'technology', not 'tech'" in description

**Valid categories:**
- `breaking`, `business`, `crime`, `entertainment`, `politics`, `science`, `top`, `world`, `technology`, `domestic`

**Valid analysis types:**
- `twitter`, `reddit`, `ai_sentiment`

---

### Issue: Handler not found

**Symptom:** TypeError: handleOmniDoxaFunction is not a function

**Diagnosis:** Import path wrong or module not built

**Fix:**
```bash
# If using TypeScript, compile:
cd ~/Projects/omnidoxa
npm run build

# Or use tsx for runtime:
tsx ~/Projects/omnidoxa/src/lib/skippy/function-handler.ts
```

**Check import path:**
```typescript
// Make sure path is correct:
import { handleOmniDoxaFunction } from '~/Projects/omnidoxa/src/lib/skippy/function-handler';

// Or absolute path:
import { handleOmniDoxaFunction } from '/home/skippy/Projects/omnidoxa/src/lib/skippy/function-handler';
```

---

## Advanced Configuration

### Custom Response Messages

Edit `function-handler.ts` to customize messages:

```typescript
return {
  success: true,
  message: `🚀 Your custom message here! Run ID: ${runId}`,
  data
};
```

### Add Progress Webhooks

Have Skippy proactively notify when pipelines complete:

```typescript
// In function-handler.ts
if (runId) {
  // Poll for completion and notify user
  pollPipelineStatus(runId, (status) => {
    if (status === 'complete') {
      notifyUser(`✅ Pipeline run #${runId} complete!`);
    }
  });
}
```

### Error Notifications

Catch failures and alert:

```typescript
if (!response.ok) {
  notifyUser(`❌ Pipeline failed: ${errorText}`);
  logError('omnidoxa_pipeline_failure', { runId, error: errorText });
}
```

---

## Integration Checklist

**Before marking complete:**

- [ ] Function definitions added to Skippy's tools config
- [ ] Handler import added to main agent file
- [ ] Function call dispatcher includes `omnidoxa_*` check
- [ ] Environment variable `OMNIDOXA_API_URL` is set
- [ ] OmniDoxa dev server is running
- [ ] Tested: "Pull fresh tech articles" → success
- [ ] Tested: "Search for [topic]" → success
- [ ] Tested: "Re-run sentiment on [category]" → success
- [ ] Tested: "Check pipeline status" → success
- [ ] Error handling works (try with server stopped)

---

## Next Steps

Once integration is complete:

1. **Test in production:**  Deploy OmniDoxa to production URL and update `OMNIDOXA_API_URL`

2. **Add analytics:** Track which functions are used most:
   ```typescript
   logAnalytics('function_called', {
     function: functionName,
     category: params.category || params.categories,
     user_request: userRequest
   });
   ```

3. **Improve UX:** Add progress updates during long-running pipelines:
   ```typescript
   await updateUser("🔄 Still analyzing... 45% done");
   ```

4. **Expand functions:** Add more operations:
   - `omnidoxa_export_data` - Export analysis results
   - `omnidoxa_schedule_refresh` - Schedule recurring updates
   - `omnidoxa_get_insights` - Get AI-generated insights

5. **Shadow mode:** Run alongside existing pipeline triggers to test accuracy before cutover

---

## Support

**Documentation:**
- Function definitions: `~/Projects/omnidoxa/docs/skippy-functions.md`
- Handler code: `~/Projects/omnidoxa/src/lib/skippy/function-handler.ts`
- Pipeline API docs: `~/Projects/omnidoxa/docs/omnidoxa-pipeline-redesign-final.md`

**Contact:**
- Skippy the Magnificent 🍺 (main agent)
- Check `~/clawd/memory/` for task logs

---

**Last updated:** 2026-02-28  
**Status:** Ready for testing
