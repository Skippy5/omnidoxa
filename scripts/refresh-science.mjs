import { readFileSync } from 'fs';
import Database from 'better-sqlite3';

const ENV = Object.fromEntries(readFileSync('/home/skippy/Projects/omnidoxa/.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const[k,...v]=l.split('=');return[k.trim(),v.join('=').trim()];}));
const XAI_API_KEY = ENV.XAI_API_KEY;
const db = new Database('/home/skippy/Projects/omnidoxa/omnidoxa.db');
db.pragma('foreign_keys = ON');

const SYSTEM_PROMPT = `You are an expert, truthful news sentiment analyst. Always use tools to fetch REAL data — never hallucinate. For the news story provided, use x_search to find 2-3 real recent posts from LEFT-leaning, CENTER, and RIGHT-leaning accounts. Output ONLY valid JSON:\n{"nonBiasedSummary":"...","left":{"sentiment":0.0,"summary":"...","posts":[{"text":"","author":"","url":""}]},"center":{"sentiment":0.0,"summary":"...","posts":[]},"right":{"sentiment":0.0,"summary":"...","posts":[]}}`;

const today = '2026-02-19';

// Clear science
db.prepare(`DELETE FROM social_posts WHERE viewpoint_id IN (SELECT v.id FROM viewpoints v JOIN stories s ON v.story_id=s.id WHERE s.category='science')`).run();
db.prepare(`DELETE FROM viewpoints WHERE story_id IN (SELECT id FROM stories WHERE category='science')`).run();
db.prepare(`DELETE FROM stories WHERE category='science'`).run();
console.log('🗑️  Cleared old science data');

const cache = JSON.parse(readFileSync('/home/skippy/Projects/omnidoxa/news-cache.json','utf8'));
// Deduplicate by title
const seen = new Set();
const articles = (cache.articles.science||[]).filter(a => { const t = a.title?.toLowerCase(); if(seen.has(t)) return false; seen.add(t); return true; });
console.log(`📰 Processing ${articles.length} unique science articles\n`);

for (let i = 0; i < articles.length; i++) {
  const article = articles[i];
  const start = Date.now();
  process.stdout.write(`📊 [${i+1}/${articles.length}] ${article.title.substring(0,55)}... `);
  
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 90000);
    const res = await fetch('https://api.x.ai/v1/responses', {
      method:'POST', signal: ctrl.signal,
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${XAI_API_KEY}`},
      body: JSON.stringify({ model:'grok-4-1-fast-reasoning', input:[{role:'system',content:SYSTEM_PROMPT},{role:'user',content:`Title: ${article.title}\nURL: ${article.link}\nSummary: ${(article.description||'').substring(0,400)}`}], tools:[{type:'web_search'},{type:'x_search',from_date:'2026-02-01',to_date:today}], temperature:0, max_output_tokens:3000 })
    });
    clearTimeout(t);
    const data = await res.json();
    const usage = data.usage||{};
    let content = null;
    for(const item of data.output||[]) { if(item.type==='message'&&item.role==='assistant') { for(const c of item.content||[]) { if(c.type==='output_text'||c.type==='text'){content=c.text;break;} } } }
    const analysis = JSON.parse(content.replace(/^```json\s*/m,'').replace(/^```\s*/m,'').replace(/```\s*$/m,'').trim());
    
    const sr = db.prepare(`INSERT INTO stories (title,description,url,source,image_url,category,published_at,fetched_at) VALUES (?,?,?,?,?,?,?,?)`).run(article.title,analysis.nonBiasedSummary||article.description||'',article.link,article.source_name||'Unknown',article.image_url||null,'science',article.pubDate||new Date().toISOString(),new Date().toISOString());
    let posts = 0;
    for(const lean of ['left','center','right']) {
      const p = analysis[lean]; if(!p) continue;
      const vr = db.prepare(`INSERT INTO viewpoints (story_id,lean,summary,sentiment_score) VALUES (?,?,?,?)`).run(sr.lastInsertRowid,lean,p.summary||'',Math.max(-1,Math.min(1,p.sentiment||0)));
      for(const post of p.posts||[]) { if(!post.text||!post.url) continue; const h=post.author?.startsWith('@')?post.author:`@${post.author||'unknown'}`; db.prepare(`INSERT INTO social_posts (viewpoint_id,author,author_handle,text,url,platform,likes,retweets,is_real,post_date) VALUES (?,?,?,?,?,?,0,0,1,NULL)`).run(vr.lastInsertRowid,h,h,post.text,post.url,'x'); posts++; }
    }
    const elapsed = ((Date.now()-start)/1000).toFixed(1);
    const cost = (((usage.input_tokens||0)*0.20+(usage.output_tokens||0)*0.50)/1_000_000).toFixed(4);
    console.log(`✅ ${posts} posts | ${elapsed}s | ~$${cost}`);
  } catch(err) {
    console.log(`❌ ${err.message?.substring(0,60)}`);
  }
  if(i < articles.length-1) await new Promise(r=>setTimeout(r,3000));
}

const total = db.prepare("SELECT COUNT(*) as c FROM social_posts WHERE is_real=1").get().c;
console.log(`\n✅ SCIENCE DONE! Total real posts in DB: ${total}`);
