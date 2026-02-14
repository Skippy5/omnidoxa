# Simple Vercel Setup (No Database Required!)

## Simplest Solution: Use Vercel KV (Redis Cache)

No database setup needed - just cache the fetched news in Redis!

## Steps

### 1. Create Vercel KV Store
1. Go to https://vercel.com/skippy5/omnidoxa
2. Click "Storage" tab
3. Click "Create Database" → "KV" (Redis)
4. Name: `omnidoxa-cache`
5. Click "Create"

This automatically adds `KV_*` environment variables to your project.

### 2. Install Vercel KV package
```bash
npm install @vercel/kv
```

### 3. Create Cron Endpoint
File: `src/app/api/cron/fetch-news/route.ts`
```typescript
import { kv } from '@vercel/kv';
import { fetchAllCategories } from '@/lib/newsdata';

export async function GET(request: Request) {
  // Verify cron secret (Vercel adds this automatically)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Fetch 50 articles (10 categories × 5 each)
    const articles = await fetchAllCategories(5);
    
    // Store in Redis with 24-hour expiry
    await kv.set('omnidoxa:stories', articles, { ex: 86400 });
    await kv.set('omnidoxa:fetched_at', new Date().toISOString());

    return Response.json({ 
      success: true, 
      articles: Object.values(articles).flat().length 
    });
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
```

### 4. Update Stories API to Read from Cache
File: `src/app/api/stories/route.ts`
```typescript
import { kv } from '@vercel/kv';

export async function GET() {
  try {
    // Try to get from cache first
    const stories = await kv.get('omnidoxa:stories');
    const fetchedAt = await kv.get('omnidoxa:fetched_at');

    if (stories) {
      return Response.json({ 
        stories: Object.values(stories).flat(), 
        fetched_at: fetchedAt 
      });
    }

    // If no cache, return empty (cron will populate soon)
    return Response.json({ 
      stories: [], 
      message: 'Stories are being fetched. Check back in a few minutes!' 
    });
  } catch (error) {
    return Response.json({ 
      stories: [], 
      error: 'Failed to load stories' 
    }, { status: 500 });
  }
}
```

### 5. Deploy
```bash
git add -A
git commit -m "Add Vercel KV caching + cron job"
git push origin main
```

## How It Works
- **First deploy**: Site shows "Stories being fetched..."
- **Cron runs (6 AM/6 PM)**: Fetches 50 articles → stores in Redis
- **Users visit**: Instant page loads (reads from Redis cache)
- **Cache expires**: After 24 hours, cron refreshes

## Manual Trigger (for testing)
You can manually trigger the cron job:
```bash
curl https://omnidoxa.vercel.app/api/cron/fetch-news \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Find `CRON_SECRET` in Vercel → Settings → Environment Variables.

## Why This Works
✅ No database setup  
✅ Fast page loads (cached)  
✅ Auto-updates twice daily  
✅ Scales infinitely (Redis)  
✅ Works on Vercel free tier
