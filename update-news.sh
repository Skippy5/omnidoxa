#!/bin/bash
# One-command news update for Vercel deployment

echo "🌐 OmniDoxa News Update"
echo "======================="
echo ""

# Check if database exists
if [ ! -f omnidoxa.db ]; then
  echo "❌ No database found. Run 'npm run dev' first and let it fetch news."
  exit 1
fi

# Count stories in database
STORY_COUNT=$(node -e "const db=require('better-sqlite3')('./omnidoxa.db',{readonly:true});const c=db.prepare('SELECT COUNT(*) as n FROM stories').get();console.log(c.n);db.close()")

if [ "$STORY_COUNT" -lt "40" ]; then
  echo "⚠️  Only $STORY_COUNT stories in database (need 40+)"
  echo "   Fetch fresh news first: curl 'http://localhost:3000/api/news/fetch?refresh=true'"
  exit 1
fi

echo "📊 Found $STORY_COUNT stories in local database"
echo ""

# Generate stories.json
echo "🔄 Generating public/stories.json..."
node -e "
const db = require('better-sqlite3')('./omnidoxa.db', {readonly: true});
const stories = db.prepare('SELECT * FROM stories ORDER BY created_at DESC').all();
const viewpoints = db.prepare('SELECT * FROM viewpoints').all();
const socialPosts = db.prepare('SELECT * FROM social_posts').all();

const enrichedStories = stories.map(story => {
  const storyViewpoints = viewpoints.filter(v => v.story_id === story.id).map(vp => ({
    ...vp,
    social_posts: socialPosts.filter(sp => sp.viewpoint_id === vp.id)
  }));
  return { ...story, viewpoints: storyViewpoints };
});

const output = {
  stories: enrichedStories,
  fetched_at: new Date().toISOString(),
  total: enrichedStories.length,
  categories: {}
};

enrichedStories.forEach(s => {
  output.categories[s.category] = (output.categories[s.category] || 0) + 1;
});

const fs = require('fs');
fs.mkdirSync('public', {recursive: true});
fs.writeFileSync('public/stories.json', JSON.stringify(output, null, 2));

console.log('✅ Generated:', output.total, 'stories,', Object.keys(output.categories).length, 'categories');
db.close();
"

if [ ! -f public/stories.json ]; then
  echo "❌ Failed to generate stories.json"
  exit 1
fi

SIZE=$(stat -c%s public/stories.json 2>/dev/null || stat -f%z public/stories.json)
SIZE_KB=$((SIZE / 1024))
echo "   File size: ${SIZE_KB} KB"
echo ""

# Git commit and push
echo "📤 Committing and pushing to GitHub..."
git add public/stories.json

if git diff --staged --quiet; then
  echo "ℹ️  No changes to stories.json"
else
  git commit -m "Update news stories $(date +'%Y-%m-%d %H:%M')" 
  git push origin main
  echo ""
  echo "✅ Pushed to GitHub!"
  echo "   Vercel will deploy in ~2 minutes: https://omnidoxa.vercel.app/"
fi

echo ""
echo "🎉 Done!"
