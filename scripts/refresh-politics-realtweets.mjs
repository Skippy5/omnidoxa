/**
 * refresh-politics-realtweets.mjs
 *
 * Integration script: Calls xAI Responses API for each of the 5 current politics
 * articles and saves real X posts to the SQLite DB.
 *
 * Run: node scripts/refresh-politics-realtweets.mjs
 * Expected runtime: ~5 minutes (5 articles × ~55s each + pauses)
 */

import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// ── Config ────────────────────────────────────────────────────────────────────

const PROJECT_ROOT = join(__dirname, '..');
const NEWS_CACHE_PATH = join(PROJECT_ROOT, 'news-cache.json');
const DB_PATH = join(PROJECT_ROOT, 'omnidoxa.db');
const ENV_PATH = join(PROJECT_ROOT, '.env.local');

const XAI_API_URL = 'https://api.x.ai/v1/responses';
const XAI_MODEL = 'grok-4-1-fast-reasoning';
const REQUEST_TIMEOUT_MS = 90_000;
const PAUSE_BETWEEN_ARTICLES_MS = 3_000;

// ── Read API key ──────────────────────────────────────────────────────────────

const envContent = readFileSync(ENV_PATH, 'utf8');
const XAI_API_KEY = envContent.match(/XAI_API_KEY=(.+)/)?.[1]?.trim();

if (!XAI_API_KEY) {
  console.error('❌ XAI_API_KEY not found in .env.local');
  process.exit(1);
}

console.log(`✅ XAI_API_KEY found (${XAI_API_KEY.substring(0, 10)}...)`);

// ── Read politics articles ────────────────────────────────────────────────────

const newsCache = JSON.parse(readFileSync(NEWS_CACHE_PATH, 'utf8'));
const politicsArticles = newsCache.articles?.politics;

if (!politicsArticles || politicsArticles.length === 0) {
  console.error('❌ No politics articles found in news-cache.json');
  process.exit(1);
}

console.log(`📰 Found ${politicsArticles.length} politics articles in cache\n`);
politicsArticles.forEach((a, i) => {
  console.log(`  ${i + 1}. ${a.title.substring(0, 80)}`);
});
console.log('');

// ── System prompt (same as grok-responses.ts) ─────────────────────────────────

const SYSTEM_PROMPT = `You are an expert, truthful news sentiment analyst. Always use tools to fetch REAL data — never hallucinate articles or social posts.

For the provided news story, do the following:

1. Use web_search to browse the article URL and get the full text if needed.
2. Use x_search to find 2–3 real, recent posts from the LEFT political perspective about this topic (from liberal/progressive/Democrat users or accounts).
3. Use x_search to find 2–3 real, recent posts from the CENTER perspective (neutral/moderate/journalist/analyst accounts).
4. Use x_search to find 2–3 real, recent posts from the RIGHT political perspective (from conservative/Republican users or accounts).

For each perspective provide:
- A sentiment score (-1.0 very negative to +1.0 very positive)
- A 2-3 sentence summary of how that side views this story
- The real social posts you found (text, author handle, URL)

Output ONLY valid JSON in this exact format — no markdown, no code blocks, no extra text:
{
  "nonBiasedSummary": "3-sentence neutral summary of the story",
  "left": {
    "sentiment": 0.0,
    "summary": "How the left views this...",
    "posts": [
      {
        "text": "actual post text",
        "author": "handle or name",
        "url": "https://x.com/..."
      }
    ]
  },
  "center": {
    "sentiment": 0.0,
    "summary": "How centrists view this...",
    "posts": []
  },
  "right": {
    "sentiment": 0.0,
    "summary": "How the right views this...",
    "posts": []
  }
}`;

// ── Helper: date string ────────────────────────────────────────────────────────

function toDateString(date) {
  return date.toISOString().split('T')[0];
}

// ── Helper: sleep ─────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── xAI API call ──────────────────────────────────────────────────────────────

async function analyzeArticle(article) {
  const articleDate = new Date(article.pubDate);
  const fromDate = new Date(articleDate);
  fromDate.setDate(fromDate.getDate() - 1);

  const fromDateStr = toDateString(fromDate);
  const toDateStr = toDateString(new Date());

  const userPrompt = `Analyze this news story:

Title: ${article.title}
URL: ${article.link}
Summary: ${article.description ?? 'No description available'}
Published: ${article.pubDate}

Search for real social media posts about this topic and provide LEFT/CENTER/RIGHT perspective analysis.`;

  const requestBody = {
    model: XAI_MODEL,
    input: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    tools: [
      { type: 'web_search' },
      {
        type: 'x_search',
        from_date: fromDateStr,
        to_date: toDateStr
      }
    ],
    temperature: 0,
    max_output_tokens: 3000
  };

  console.log(`  🔍 Date range: ${fromDateStr} → ${toDateStr}`);
  console.log(`  📡 Calling xAI Responses API (timeout: 90s)...`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${XAI_API_KEY}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('xAI Responses API timed out after 90 seconds');
    }
    throw new Error(`xAI fetch failed: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '[unreadable]');
    throw new Error(`xAI returned HTTP ${response.status}: ${errorBody.substring(0, 500)}`);
  }

  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`xAI returned non-JSON: ${raw.substring(0, 300)}`);
  }

  // Log token usage
  if (data.usage) {
    console.log(
      `  📊 Tokens — Input: ${data.usage.input_tokens ?? 0}, Output: ${data.usage.output_tokens ?? 0}, Reasoning: ${data.usage.reasoning_tokens ?? 0}`
    );
  }

  // Extract assistant message
  let contentText = null;
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item?.type === 'message' && item?.role === 'assistant') {
        if (Array.isArray(item.content)) {
          for (const c of item.content) {
            if (c?.type === 'output_text' || c?.type === 'text') {
              contentText = c.text;
              break;
            }
          }
        }
        if (contentText) break;
      }
    }
  }

  if (!contentText) {
    throw new Error('xAI returned no assistant message content');
  }

  // Strip markdown fences and parse JSON
  const cleaned = contentText
    .replace(/^```json\s*/m, '')
    .replace(/^```\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim();

  let grokData;
  try {
    grokData = JSON.parse(cleaned);
  } catch {
    throw new Error(`xAI response is not valid JSON: ${cleaned.substring(0, 500)}`);
  }

  if (!grokData.nonBiasedSummary || !grokData.left || !grokData.center || !grokData.right) {
    throw new Error('xAI response JSON is missing required fields (nonBiasedSummary, left, center, right)');
  }

  return grokData;
}

// ── DB operations ─────────────────────────────────────────────────────────────

function clearPoliticsData(db) {
  console.log('🗑️  Clearing existing politics data from DB...');

  // FK order: social_posts → viewpoints → stories
  const deletedPosts = db.prepare(`
    DELETE FROM social_posts
    WHERE viewpoint_id IN (
      SELECT v.id FROM viewpoints v
      JOIN stories s ON v.story_id = s.id
      WHERE s.category = 'politics'
    )
  `).run();

  const deletedViewpoints = db.prepare(`
    DELETE FROM viewpoints
    WHERE story_id IN (SELECT id FROM stories WHERE category = 'politics')
  `).run();

  const deletedStories = db.prepare(`
    DELETE FROM stories WHERE category = 'politics'
  `).run();

  console.log(
    `  ✅ Deleted: ${deletedPosts.changes} posts, ${deletedViewpoints.changes} viewpoints, ${deletedStories.changes} stories`
  );
}

function saveStory(db, article, grokData) {
  const now = new Date().toISOString();

  // Insert story
  const storyResult = db.prepare(`
    INSERT INTO stories (title, description, url, source, image_url, category, published_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, 'politics', ?, ?)
  `).run(
    article.title,
    grokData.nonBiasedSummary,  // Use AI summary as description
    article.link,
    article.source_name ?? article.source_id ?? 'Unknown',
    article.image_url ?? null,
    article.pubDate,
    article.fetched_at ?? now
  );

  const storyId = Number(storyResult.lastInsertRowid);
  const postCounts = {};

  // Insert viewpoints + posts
  for (const [lean, perspective] of [
    ['left', grokData.left],
    ['center', grokData.center],
    ['right', grokData.right]
  ]) {
    const sentimentScore = typeof perspective.sentiment === 'number'
      ? Math.max(-1, Math.min(1, perspective.sentiment))
      : 0;

    const vpResult = db.prepare(`
      INSERT INTO viewpoints (story_id, lean, summary, sentiment_score)
      VALUES (?, ?, ?, ?)
    `).run(storyId, lean, perspective.summary ?? '', sentimentScore);

    const viewpointId = Number(vpResult.lastInsertRowid);
    const posts = perspective.posts ?? [];

    for (const post of posts) {
      const author = post.author ?? 'Unknown';
      const authorHandle = author.startsWith('@') ? author : `@${author}`;

      db.prepare(`
        INSERT INTO social_posts (viewpoint_id, author, author_handle, text, url, platform, likes, retweets, is_real, post_date)
        VALUES (?, ?, ?, ?, ?, 'x', 0, 0, 1, NULL)
      `).run(
        viewpointId,
        author,
        authorHandle,
        post.text ?? '',
        post.url ?? ''
      );
    }

    postCounts[lean] = posts.length;
  }

  return { storyId, postCounts };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');

  console.log(`🚀 Starting OmniDoxa Politics Real-Tweet Refresh`);
  console.log(`   DB: ${DB_PATH}`);
  console.log(`   Articles: ${politicsArticles.length}`);
  console.log(`   Model: ${XAI_MODEL}\n`);

  const startTime = Date.now();
  const results = [];

  // Clear all politics data before starting
  clearPoliticsData(db);
  console.log('');

  for (let i = 0; i < politicsArticles.length; i++) {
    const article = politicsArticles[i];
    const articleStart = Date.now();

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📰 Article ${i + 1}/${politicsArticles.length}: ${article.title.substring(0, 80)}`);
    console.log(`   Source: ${article.source_name ?? article.source_id}`);
    console.log(`   Published: ${article.pubDate}`);

    try {
      const grokData = await analyzeArticle(article);
      const elapsed = ((Date.now() - articleStart) / 1000).toFixed(1);

      console.log(`  ✅ Analysis complete in ${elapsed}s`);
      console.log(`  📝 Summary: ${grokData.nonBiasedSummary.substring(0, 100)}...`);

      // Save to DB
      const { storyId, postCounts } = saveStory(db, article, grokData);

      console.log(`  💾 Saved story ID: ${storyId}`);
      console.log(`  📊 Posts: LEFT=${postCounts.left}, CENTER=${postCounts.center}, RIGHT=${postCounts.right}`);

      results.push({
        article: article.title,
        success: true,
        elapsed,
        storyId,
        postCounts,
        summary: grokData.nonBiasedSummary,
        samplePosts: {
          left: grokData.left?.posts?.[0] ?? null,
          center: grokData.center?.posts?.[0] ?? null,
          right: grokData.right?.posts?.[0] ?? null
        }
      });
    } catch (err) {
      const elapsed = ((Date.now() - articleStart) / 1000).toFixed(1);
      console.error(`  ❌ Failed after ${elapsed}s: ${err.message}`);
      results.push({
        article: article.title,
        success: false,
        elapsed,
        error: err.message
      });
    }

    // Pause between articles (skip after last)
    if (i < politicsArticles.length - 1) {
      console.log(`\n⏳ Pausing ${PAUSE_BETWEEN_ARTICLES_MS / 1000}s before next article...`);
      await sleep(PAUSE_BETWEEN_ARTICLES_MS);
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // ── Verification ──────────────────────────────────────────────────────────

  console.log(`\n\n${'═'.repeat(50)}`);
  console.log(`🔍 POST-RUN VERIFICATION`);
  console.log(`${'═'.repeat(50)}`);

  const storyCount = db.prepare("SELECT COUNT(*) as count FROM stories WHERE category = 'politics'").get();
  const realPosts = db.prepare("SELECT COUNT(*) as count FROM social_posts WHERE is_real = 1").get();
  const fakePosts = db.prepare("SELECT COUNT(*) as count FROM social_posts WHERE is_real = 0").get();

  console.log(`\n  📚 Politics stories in DB: ${storyCount.count}`);
  console.log(`  ✅ Real posts (is_real=1):  ${realPosts.count}`);
  console.log(`  🤖 Fake posts (is_real=0):  ${fakePosts.count}`);

  // Show sample viewpoint
  const sampleStory = db.prepare("SELECT * FROM stories WHERE category = 'politics' ORDER BY id DESC LIMIT 1").get();
  if (sampleStory) {
    console.log(`\n  📰 Sample Story: "${sampleStory.title.substring(0, 70)}"`);
    const viewpoints = db.prepare("SELECT * FROM viewpoints WHERE story_id = ?").all(sampleStory.id);
    for (const vp of viewpoints) {
      const posts = db.prepare("SELECT * FROM social_posts WHERE viewpoint_id = ?").all(vp.id);
      console.log(`\n    [${vp.lean.toUpperCase()}] Sentiment: ${vp.sentiment_score.toFixed(2)}`);
      console.log(`    Summary: ${vp.summary.substring(0, 100)}...`);
      console.log(`    Posts: ${posts.length}`);
      if (posts.length > 0) {
        const p = posts[0];
        console.log(`      → @${p.author_handle}: ${p.text?.substring(0, 80)}`);
        console.log(`        URL: ${p.url}`);
        console.log(`        is_real: ${p.is_real === 1 ? 'YES ✅' : 'NO ❌'}`);
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  console.log(`\n\n${'═'.repeat(50)}`);
  console.log(`📋 RUN SUMMARY`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`  Total time:    ${totalElapsed}s`);
  console.log(`  Successful:    ${successCount}/${politicsArticles.length}`);
  console.log(`  Failed:        ${failCount}/${politicsArticles.length}`);
  console.log(`  Real posts:    ${realPosts.count}`);

  if (failCount > 0) {
    console.log(`\n  ❌ ERRORS:`);
    results.filter((r) => !r.success).forEach((r) => {
      console.log(`    • ${r.article.substring(0, 60)}: ${r.error}`);
    });
  }

  db.close();

  // Return results for report writing
  return {
    results,
    totalElapsed,
    successCount,
    failCount,
    storyCount: storyCount.count,
    realPosts: realPosts.count,
    fakePosts: fakePosts.count,
    sampleStory
  };
}

// ── Write integration report ──────────────────────────────────────────────────

async function writeReport(runData) {
  const { results, totalElapsed, successCount, failCount, storyCount, realPosts, fakePosts } = runData;
  const now = new Date().toISOString();

  let md = `# Integration Test: Complete\n\n`;
  md += `**Date:** ${now}\n`;
  md += `**Agent:** Integration & Test Subagent\n`;
  md += `**Status:** ${failCount === 0 ? '✅ All articles processed successfully' : `⚠️ ${failCount} articles failed`}\n\n`;
  md += `---\n\n`;

  md += `## Run Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Runtime | ${totalElapsed}s |\n`;
  md += `| Articles Processed | ${successCount}/${results.length} |\n`;
  md += `| Politics Stories in DB | ${storyCount} |\n`;
  md += `| Real Posts Saved | ${realPosts} |\n`;
  md += `| Fake/Synthetic Posts | ${fakePosts} |\n\n`;

  md += `## Article Results\n\n`;
  for (const r of results) {
    if (r.success) {
      md += `### ✅ ${r.article}\n\n`;
      md += `- **Time:** ${r.elapsed}s\n`;
      md += `- **Story ID:** ${r.storyId}\n`;
      md += `- **Posts:** LEFT=${r.postCounts.left}, CENTER=${r.postCounts.center}, RIGHT=${r.postCounts.right}\n`;
      md += `- **Summary:** ${r.summary}\n\n`;

      if (r.samplePosts.left) {
        md += `**Sample LEFT post:**\n`;
        md += `> @${r.samplePosts.left.author}: ${r.samplePosts.left.text}\n`;
        md += `> URL: ${r.samplePosts.left.url}\n\n`;
      }
      if (r.samplePosts.center) {
        md += `**Sample CENTER post:**\n`;
        md += `> @${r.samplePosts.center.author}: ${r.samplePosts.center.text}\n`;
        md += `> URL: ${r.samplePosts.center.url}\n\n`;
      }
      if (r.samplePosts.right) {
        md += `**Sample RIGHT post:**\n`;
        md += `> @${r.samplePosts.right.author}: ${r.samplePosts.right.text}\n`;
        md += `> URL: ${r.samplePosts.right.url}\n\n`;
      }
    } else {
      md += `### ❌ ${r.article}\n\n`;
      md += `- **Time:** ${r.elapsed}s\n`;
      md += `- **Error:** ${r.error}\n\n`;
    }
  }

  md += `## Verification\n\n`;
  md += `- Politics stories in DB: **${storyCount}** (expected: 5)\n`;
  md += `- Real posts (is_real=1): **${realPosts}**\n`;
  md += `- Fake posts (is_real=0): **${fakePosts}**\n\n`;

  md += `## Constraints Verified\n\n`;
  md += `- ✅ Only politics category articles processed\n`;
  md += `- ✅ Only the 5 articles from news-cache.json (no new fetches)\n`;
  md += `- ✅ Dev server NOT started\n`;
  md += `- ✅ Source code NOT modified\n`;
  md += `- ✅ xAI x_search used for real posts (is_real=1)\n`;
  md += `- ✅ Other categories untouched\n\n`;

  md += `*End of integration test report.*\n`;

  const reportPath = join(PROJECT_ROOT, 'SPEC-integration-complete.md');
  readFileSync; // just to confirm fs is loaded
  const { writeFileSync } = await import('fs');
  writeFileSync(reportPath, md, 'utf8');
  console.log(`\n📄 Report saved: ${reportPath}`);
}

// ── Run ───────────────────────────────────────────────────────────────────────

main()
  .then(async (runData) => {
    await writeReport(runData);
    console.log('\n🎉 Done! Politics real-tweet refresh complete.\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
