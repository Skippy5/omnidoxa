# SPEC: DB Migration — Add `is_real` + `post_date` to social_posts

**Date:** 2026-02-19  
**Status:** ✅ APPLIED — migration has been run against live `omnidoxa.db`  
**Purpose:** Support real xAI x_search posts alongside synthetic keyword-generated fallbacks.

---

## 1. Schema Analysis

### Current `social_posts` table (before migration)

| Column       | Type    | Constraints           | Notes                            |
|--------------|---------|-----------------------|----------------------------------|
| id           | INTEGER | PK AUTOINCREMENT      |                                  |
| viewpoint_id | INTEGER | NOT NULL, FK          | → viewpoints.id ON DELETE CASCADE|
| author       | TEXT    | NOT NULL              | Display name (e.g. "Nick Timiraos") |
| author_handle| TEXT    | NOT NULL              | Handle (e.g. "@NickTimiraos")   |
| text         | TEXT    | NOT NULL              | Post body                        |
| url          | TEXT    | NOT NULL              | Link to post                     |
| platform     | TEXT    | NOT NULL              | "x", "reddit", "bluesky", etc.  |
| likes        | INTEGER | NOT NULL DEFAULT 0    | Engagement metric                |
| retweets     | INTEGER | NOT NULL DEFAULT 0    | Engagement metric                |
| created_at   | TEXT    | NOT NULL DEFAULT now  | Row insert time                  |

### Decisions

**`is_real` (boolean flag)** — ADD ✅  
Required. Distinguishes real posts fetched from xAI x_search (or other live sources) from
synthetic/keyword-generated fallback posts. Without this flag, the developer agent has no way
to know which posts need re-fetching, which are authoritative, or whether to display a "real
source" badge in the UI.  
→ Stored as `INTEGER NOT NULL DEFAULT 0` (SQLite convention: 0 = false, 1 = true).  
→ Defaults to 0 so existing rows (synthetic) are correctly classified without a backfill.

**`post_date` (original post timestamp)** — ADD ✅  
Recommended. Real posts from x_search have a publication date (inferable from the tweet status
ID or returned metadata). Storing it enables:
- Sorting posts by actual recency rather than DB insert time
- Showing "posted 3 hours ago" labels in the UI
- Future deduplication by date range
→ Stored as `TEXT` (ISO-8601, e.g. `"2026-02-19T14:30:00Z"`), nullable.  
→ NULL for synthetic fallback posts where no meaningful date exists.

**`platform TEXT NOT NULL`** — KEEP AS-IS ✅  
Sufficient. An enum/CHECK constraint isn't worth the maintenance overhead right now — when
bluesky and reddit are added, a CHECK constraint can be added via a separate migration. For now,
plain TEXT with a comment in types.ts is the right call.

**`likes` / `retweets` nullable?** — NO CHANGE ✅  
Keep as `NOT NULL DEFAULT 0`. Real posts simply have 0 likes/retweets (engagement data is
unavailable from x_search). Making them nullable would add null-checks everywhere in the UI and
API layer for no practical gain. The `is_real` flag signals "these metrics aren't meaningful."

---

## 2. Migration Applied

**Script:** `scripts/migrate-add-is-real.ts`  
**Execution:** Node.js inline (equivalent to script logic)

```sql
ALTER TABLE social_posts ADD COLUMN is_real INTEGER NOT NULL DEFAULT 0;
ALTER TABLE social_posts ADD COLUMN post_date TEXT;
```

**Result — final columns:**  
`id, viewpoint_id, author, author_handle, text, url, platform, likes, retweets, created_at, is_real, post_date`

**Idempotent:** Yes. The migration script checks `PRAGMA table_info` before each ALTER TABLE.
Running it again is safe.

**Running the script manually:**
```bash
cd ~/Projects/omnidoxa
node --experimental-strip-types scripts/migrate-add-is-real.ts
```

---

## 3. Files Modified

### `src/lib/schema.ts`
Added `is_real` and `post_date` to the `CREATE TABLE IF NOT EXISTS social_posts` block:
```sql
is_real INTEGER NOT NULL DEFAULT 0,
post_date TEXT,
```
(Placed after `retweets`, before `created_at`)

### `src/lib/types.ts` — `SocialPost` interface
```typescript
export interface SocialPost {
  // ... existing fields ...
  is_real: boolean;     // true = real post, false = synthetic fallback
  post_date: string | null;  // ISO-8601 from source platform, null for synthetic
  created_at: string;
}
```

### `src/lib/db.ts` — Two changes

**Change 1 — `enrichStoryWithViewpoints` (READ path)**  
Added `is_real` coercion from SQLite INTEGER (0/1) to JavaScript boolean:
```typescript
const socialPosts = (db.prepare('SELECT * FROM social_posts WHERE viewpoint_id = ? ORDER BY likes DESC')
  .all(vp.id) as (Omit<SocialPost, 'is_real'> & { is_real: number })[])
  .map((row) => ({ ...row, is_real: Boolean(row.is_real) }) as SocialPost);
```
> **Why:** SQLite has no native boolean type. better-sqlite3 returns `0` or `1` for INTEGER
> columns. Without this coercion, TypeScript callers get a number where they expect a boolean.
> This is the single authoritative conversion point.

**Change 2 — `saveStoryWithViewpoints` (WRITE path)**  
Updated INSERT to include `is_real` and `post_date`:
```typescript
db.prepare(`
  INSERT INTO social_posts (viewpoint_id, author, author_handle, text, url, platform, likes, retweets, is_real, post_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  viewpointId, post.author, post.author_handle, post.text, post.url,
  post.platform, post.likes, post.retweets,
  post.is_real ? 1 : 0,   // boolean → SQLite INTEGER
  post.post_date ?? null
);
```

---

## 4. Usage Guide for Developer Agent

### Creating a real post object
```typescript
import type { SocialPost } from '@/lib/types';

// Real post from xAI x_search
const realPost: Omit<SocialPost, 'id' | 'created_at'> = {
  viewpoint_id: vpId,          // from DB insert
  author: 'Nick Timiraos',     // display name (can be same as handle if unknown)
  author_handle: '@NickTimiraos',
  text: 'So this is one part quirk of the transition...',
  url: 'https://x.com/NickTimiraos/status/2024269176261558644',
  platform: 'x',
  likes: 0,                    // not available from x_search
  retweets: 0,                 // not available from x_search
  is_real: true,               // ← KEY DIFFERENCE
  post_date: '2026-02-19T14:30:00Z',  // from xAI response metadata, or null if unavailable
};

// Synthetic fallback post
const fakePost: Omit<SocialPost, 'id' | 'created_at'> = {
  // ... fields ...
  is_real: false,
  post_date: null,
};
```

### Querying real posts only
```sql
SELECT * FROM social_posts WHERE is_real = 1 ORDER BY post_date DESC;
```

### Checking in TypeScript
```typescript
if (post.is_real) {
  // Show "real source" badge, link to original tweet
}
```

---

## 5. What the Developer Agent Still Needs to Do

The fetch pipeline (wherever xAI x_search results are assembled into `SocialPost` objects)
must set:
- `is_real: true` for every post returned from x_search
- `is_real: false` for any synthetic/keyword-generated fallback
- `post_date: <ISO string>` from the xAI response metadata if available, otherwise `null`
- `author`: Real display name (use handle without `@` if display name is unavailable)
- `author_handle`: The `@handle` string as returned by x_search

The database and types are ready. The schema, types, and db layer are all consistent.
