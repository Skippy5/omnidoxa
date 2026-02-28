const { getDb } = require('./lib/db');

async function verify() {
  const db = await getDb();
  
  // Count viewpoints for stories 1, 2, 3
  const count = db.prepare('SELECT COUNT(*) as total FROM viewpoints WHERE story_id IN (1,2,3)').get();
  console.log(`Total viewpoints for stories 1-3: ${count.total}`);
  
  // Get sample viewpoints with real content
  const samples = db.prepare(`
    SELECT story_id, lean, SUBSTR(summary, 1, 100) as summary_preview 
    FROM viewpoints 
    WHERE story_id IN (1,2,3)
    ORDER BY story_id, lean
    LIMIT 10
  `).all();
  
  console.log('\nSample viewpoints:');
  samples.forEach(row => {
    const hasRealContent = row.summary_preview && 
                           row.summary_preview.length > 20 &&
                           !row.summary_preview.includes('Analysis unavailable');
    console.log(`Story ${row.story_id} [${row.lean}]: ${hasRealContent ? '✅' : '❌'} "${row.summary_preview}..."`);
  });
  
  // Also check the most recent viewpoints
  const recent = db.prepare(`
    SELECT story_id, lean, SUBSTR(summary, 1, 100) as summary_preview 
    FROM viewpoints 
    ORDER BY id DESC
    LIMIT 5
  `).all();
  
  console.log('\nMost recent viewpoints:');
  recent.forEach(row => {
    const hasRealContent = row.summary_preview && 
                           row.summary_preview.length > 20 &&
                           !row.summary_preview.includes('Analysis unavailable');
    console.log(`Story ${row.story_id} [${row.lean}]: ${hasRealContent ? '✅' : '❌'} "${row.summary_preview}..."`);
  });
}

verify().catch(console.error);
