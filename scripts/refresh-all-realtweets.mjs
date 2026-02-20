/**
 * Full Refresh — All Categories with Real xAI x_search Posts
 * 
 * Processes all categories from news-cache.json EXCEPT politics (already done).
 * Logs timing, token usage, and cost estimates.
 * 
 * Run: node scripts/refresh-all-realtweets.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

// --- Config ---
const ENV = Object.fromEntries(
  readFileSync(path.join(PROJECT_ROOT, '.env.local'), 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);
const XAI_API_KEY = ENV.XAI_API_KEY;
if (!XAI_API_KEY) { console.error('❌ XAI_API_KEY not found'); process.exit(1); }

const db = new Database(path.join(PROJECT_ROOT, 'omnidoxa.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Skip politics (already done) ---
const SKIP_CATEGORIES = ['politics'];

// --- Load articles ---
const cache = JSON.parse(readFileSync(path.join(PROJECT_ROOT, 'news-cache.json'), 'utf8'));
const allCategories = Object.keys(cache.articles).filter(c => !SKIP_CATEGORIES.includes(c));
const today = new Date().toISOString().split('T')[0];
const fromDate = '2026-02-01';

// --- System prompt ---
const SYSTEM_PROMPT = `You are an expert, truthful news sentiment analyst. Always use tools to fetch REAL data — never hallucinate articles or social posts.

For the provided news story:
1. Use web_search to get the full article text if the description is incomplete.
2. Use x_search to find 2-3 real recent posts from LEFT-leaning accounts (liberal/progressive/Democrat users).
3. Use x_search to find 2-3 real recent posts from CENTER accounts (neutral/moderate/journalist/analyst).
4. Use x_search to find 2-3 real recent posts from RIGHT-leaning accounts (conservative/Republican users).

For each perspective provide a sentiment score (-1.0 very negative to +1.0 very positive), a 2-3 sentence summary, and the real posts you found.

Output ONLY valid JSON with no markdown, no extra text:
{
  "nonBiasedSummary": "3-sentence neutral summary",
  "left": {
    "sentiment": 0.0,
    "summary": "How the left views this...",
    "posts": [{"text": "post text", "author": "@handle", "url": "https://x.com/..."}]
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

// --- DB helpers ---
function clearCategory(category) {
  db.prepare(`DELETE FROM social_posts WHERE viewpoint_id IN (
    SELECT v.id FROM viewpoints v JOIN stories s ON v.story_id = s.id WHERE s.category = ?
  )`).run(category);
  db.prepare(`DELETE FROM viewpoints WHERE story_id IN (SELECT id FROM stories WHERE category = ?)`).run(category);
  db.prepare(`DELETE FROM stories WHERE category = ?`).run(category);
}

function saveStory(article, category, analysis) {
  const insertStory = db.prepare(`
    INSERT INTO stories (title, description, url, source, image_url, category, published_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const storyResult = insertStory.run(
    article.title,
    analysis.nonBiasedSummary || article.description || '',
    article.link,
    article.source_name || 'Unknown',
    article.image_url || null,
    category,
    article.pubDate || new Date().toISOString(),
    new Date().toISOString()
  );
  const storyId = storyResult.lastInsertRowid;

  const insertViewpoint = db.prepare(`
    INSERT INTO viewpoints (story_id, lean, summary, sentiment_score)
    VALUES (?, ?, ?, ?)
  `);
  const insertPost = db.prepare(`
    INSERT INTO social_posts (viewpoint_id, author, author_handle, text, url, platform, likes, retweets, is_real, post_date)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, 1, NULL)
  `);

  let totalPosts = 0;
  for (const lean of ['left', 'center', 'right']) {
    const perspective = analysis[lean];
    if (!perspective) continue;

    const vpResult = insertViewpoint.run(
      storyId,
      lean,
      perspective.summary || '',
      Math.max(-1, Math.min(1, perspective.sentiment || 0))
    );
    const vpId = vpResult.lastInsertRowid;

    for (const post of (perspective.posts || [])) {
      if (!post.text || !post.url) continue;
      const handle = post.author?.startsWith('@') ? post.author : `@${post.author || 'unknown'}`;
      insertPost.run(vpId, handle, handle, post.text, post.url, 'x');
      totalPosts++;
    }
  }
  return { storyId, totalPosts };
}

// --- xAI API call ---
async function analyzeArticle(article) {
  const userPrompt = `Analyze this news story:\n\nTitle: ${article.title}\nURL: ${article.link}\nSummary: ${(article.description || '').substring(0, 500)}\nPublished: ${article.pubDate || today}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout

  const response = await fetch('https://api.x.ai/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${XAI_API_KEY}` },
    body: JSON.stringify({
      model: 'grok-4-1-fast-reasoning',
      input: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      tools: [
        { type: 'web_search' },
        { type: 'x_search', from_date: fromDate, to_date: today }
      ],
      temperature: 0,
      max_output_tokens: 3000
    }),
    signal: controller.signal
  });
  clearTimeout(timeout);

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`HTTP ${response.status}: ${err.substring(0, 200)}`);
  }

  const data = await response.json();

  // Extract usage
  const usage = data.usage || {};
  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;

  // Extract content from Responses API output array
  let content = null;
  for (const item of (data.output || [])) {
    if (item.type === 'message' && item.role === 'assistant') {
      for (const c of (item.content || [])) {
        if (c.type === 'output_text' || c.type === 'text') { content = c.text; break; }
      }
    }
  }
  if (!content) throw new Error('No content in response');

  // Strip markdown fences and parse JSON
  const cleaned = content.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
  const analysis = JSON.parse(cleaned);

  return { analysis, inputTokens, outputTokens };
}

// --- Main ---
async function main() {
  const startAll = Date.now();
  let totalArticles = 0;
  let totalSuccess = 0;
  let totalErrors = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  console.log('🚀 OmniDoxa Full Refresh — xAI Real Posts');
  console.log(`📋 Categories: ${allCategories.join(', ')}`);
  console.log(`⏭️  Skipping: ${SKIP_CATEGORIES.join(', ')} (already done)`);
  console.log(`📰 Total articles to process: ${allCategories.reduce((s, c) => s + (cache.articles[c]?.length || 0), 0)}`);
  console.log('');

  for (const category of allCategories) {
    const articles = cache.articles[category] || [];
    if (articles.length === 0) { console.log(`⏭️  Skipping ${category} (no articles)`); continue; }

    const catStart = Date.now();
    console.log(`\n📂 [${allCategories.indexOf(category) + 1}/${allCategories.length}] ${category.toUpperCase()} (${articles.length} articles)`);

    // Clear old data for this category
    clearCategory(category);
    console.log(`  🗑️  Cleared old ${category} data`);

    let catPosts = 0;

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const artStart = Date.now();
      totalArticles++;

      try {
        process.stdout.write(`  📊 [${i + 1}/${articles.length}] ${article.title.substring(0, 55)}... `);

        const { analysis, inputTokens, outputTokens } = await analyzeArticle(article);
        const { storyId, totalPosts } = saveStory(article, category, analysis);

        const elapsed = ((Date.now() - artStart) / 1000).toFixed(1);
        totalInputTokens += inputTokens;
        totalOutputTokens += outputTokens;
        catPosts += totalPosts;
        totalSuccess++;

        // Cost estimate: $0.20/M input + $0.50/M output
        const cost = ((inputTokens * 0.20 + outputTokens * 0.50) / 1_000_000).toFixed(4);
        console.log(`✅ ${totalPosts} posts | ${elapsed}s | ~$${cost} | ${inputTokens + outputTokens} tokens`);

      } catch (err) {
        const elapsed = ((Date.now() - artStart) / 1000).toFixed(1);
        totalErrors++;
        const isTimeout = err.name === 'AbortError' || err.message?.includes('abort');
        const reason = isTimeout ? 'TIMEOUT (>120s)' : err.message?.substring(0, 60);
        console.log(`⚠️  SKIPPED after ${elapsed}s [${reason}] — saving placeholder`);

        // Save the story with empty viewpoints so it still appears on the site
        try {
          const storyResult = db.prepare(`
            INSERT OR IGNORE INTO stories (title, description, url, source, image_url, category, published_at, fetched_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            article.title,
            article.description || '',
            article.link,
            article.source_name || 'Unknown',
            article.image_url || null,
            category,
            article.pubDate || new Date().toISOString(),
            new Date().toISOString()
          );
          const storyId = storyResult.lastInsertRowid;
          if (storyId) {
            const note = isTimeout
              ? 'Analysis timed out — no relevant posts found at this time.'
              : 'Analysis unavailable — no relevant posts found at this time.';
            for (const lean of ['left', 'center', 'right']) {
              db.prepare(`INSERT INTO viewpoints (story_id, lean, summary, sentiment_score) VALUES (?, ?, ?, 0)`)
                .run(storyId, lean, note);
            }
          }
        } catch (saveErr) {
          console.log(`  ↳ Could not save placeholder: ${saveErr.message?.substring(0, 60)}`);
        }
      }

      // Rate limiting: 3s between articles (except last in category)
      if (i < articles.length - 1) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    const catElapsed = ((Date.now() - catStart) / 1000).toFixed(0);
    console.log(`  ✅ ${category}: ${articles.length} articles, ${catPosts} posts, ${catElapsed}s`);

    // 5s pause between categories
    if (allCategories.indexOf(category) < allCategories.length - 1) {
      console.log(`  ⏸️  5s pause before next category...`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  const totalElapsed = ((Date.now() - startAll) / 1000 / 60).toFixed(1);

  // Final cost calculation
  const inputCost = (totalInputTokens * 0.20 / 1_000_000).toFixed(4);
  const outputCost = (totalOutputTokens * 0.50 / 1_000_000).toFixed(4);
  const totalCost = ((totalInputTokens * 0.20 + totalOutputTokens * 0.50) / 1_000_000).toFixed(4);

  console.log('\n' + '='.repeat(60));
  console.log('📊 FULL REFRESH COMPLETE');
  console.log('='.repeat(60));
  console.log(`⏱️  Total time:        ${totalElapsed} minutes`);
  console.log(`📰 Articles:          ${totalSuccess}/${totalArticles} succeeded (${totalErrors} errors)`);
  console.log(`🔤 Input tokens:      ${totalInputTokens.toLocaleString()} (~$${inputCost})`);
  console.log(`🔤 Output tokens:     ${totalOutputTokens.toLocaleString()} (~$${outputCost})`);
  console.log(`💰 Estimated cost:    ~$${totalCost} (for ${totalArticles} articles)`);
  console.log(`💰 Per article avg:   ~$${(parseFloat(totalCost) / Math.max(totalSuccess, 1)).toFixed(4)}`);
  console.log('='.repeat(60));

  // Quick DB check
  const realCount = db.prepare("SELECT COUNT(*) as c FROM social_posts WHERE is_real = 1").get().c;
  const storyCount = db.prepare("SELECT COUNT(*) as c FROM stories").get().c;
  console.log(`\n🗄️  DB Status: ${storyCount} total stories | ${realCount} real posts`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
