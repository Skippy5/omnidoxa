# OmniDoxa QA Report — Real xAI Social Posts Verification
**Date:** 2026-02-19 08:17 EST  
**Agent:** QA Agent (omnidoxa-qa)  
**Trigger:** Integration agent saved 37 real xAI social posts to SQLite database

---

## Summary

All critical checks passed. The 37 real X posts are correctly stored in the database and are being served by the Next.js API. Frontend components render them without filtering or suppression.

---

## Task 1: Database Verification

| Check | Result | Details |
|-------|--------|---------|
| Exactly 5 politics stories | ✅ PASS | IDs 344–348 |
| Each story has 3 viewpoints (left/center/right) | ✅ PASS | All 5 stories have left, center, right |
| Real post counts ≥ 1 per viewpoint with posts | ✅ PASS | All viewpoints with posts have 100% real posts |
| All real post URLs start with `https://x.com/` | ✅ PASS | 0 bad/missing URLs out of 37 |
| No NULL titles or descriptions | ✅ PASS | 0 nulls |
| Sentiment scores in range [-1.0, 1.0] | ✅ PASS | All 150 viewpoints in range |

### Real Post Distribution

| Story ID | Title (truncated) | Left | Center | Right | Total Real |
|----------|-------------------|------|--------|-------|------------|
| 344 | FOMC minutes / Powell Chair 2026 | 3 | 3 | 3 | 9 |
| 345 | Blue state counterattack / Trump GOP | 2 | 3 | 3 | 8 |
| 346 | Olympics complaint / new judging | 0 | 3 | 0 | 3 |
| 347 | Taliban legalizes wife-beating | 3 | 3 | 3 | 9 |
| 348 | U.S. military prepared to strike Iran | 3 | 3 | 2 | 8 |
| **Total** | | **11** | **15** | **11** | **37** |

> **Note:** Story 346 (Olympics) has 0 posts for left and right viewpoints. This is expected — xAI analysis found no posts for those perspectives. The UI handles empty viewpoints gracefully (shows "Analysis unavailable" fallback).

### Schema Note

The viewpoint column is `lean` (not `stance`). The three valid values are `left`, `center`, `right`. This matches the TypeScript types in `src/lib/types.ts`.

### Sample Story (Story 344 — Full Viewpoints + Posts)

```
Title: FOMC minutes showed Powell to remain as Chair for all of 2026. Gridlock, here's why.
Source: Forexlive | Category: politics
URL: https://investinglive.com/centralbank/fomc-minutes-...

LEFT viewpoint (sentiment: 0.6):
  Summary: Liberals view the story positively as it preserves Powell's tenure and Fed independence...
  Posts:
    [REAL] @Claudia_Sahm https://x.com/Claudia_Sahm/status/2024137143577092232
    [REAL] @Claudia_Sahm https://x.com/Claudia_Sahm/status/2024257166182400173
    [REAL] @maijajmtc     https://x.com/maijajmtc/status/2023987673849823614

CENTER viewpoint (sentiment: 0.0):
  Summary: Centrists and analysts emphasize the procedural nature of the minutes...
  Posts:
    [REAL] @macroderek    https://x.com/macroderek/status/2024200027476734394
    [REAL] @NickTimiraos  https://x.com/NickTimiraos/status/2024268253653016878
    [REAL] @GaetenD        https://x.com/GaetenD/status/2024132939357835404

RIGHT viewpoint (sentiment: -0.7):
  Summary: Conservatives express frustration over Republican Sen. Tillis obstructing Trump's Warsh nomination...
  Posts:
    [REAL] @BoukerJonathan https://x.com/BoukerJonathan/status/2023923179949801861
    [REAL] @jt_xrp          https://x.com/jt_xrp/status/2023987546644983823
    [REAL] @TSeekerforever  https://x.com/TSeekerforever/status/2024178894161473675
```

---

## Task 2: API Verification

| Check | Result | Details |
|-------|--------|---------|
| Dev server started successfully | ✅ PASS | Port 3000 |
| `/api/stories` returns stories with viewpoints | ✅ PASS | 50 total stories, 5 politics |
| Viewpoints include `social_posts` array | ✅ PASS | All posts present |
| `is_real: true` on real posts | ✅ PASS | Boolean correctly serialized from INTEGER |
| URLs present and non-empty | ✅ PASS | All `https://x.com/` URLs |

### Sample API Response (real post object)

```json
{
  "id": 193,
  "viewpoint_id": 1064,
  "author": "@macroderek",
  "author_handle": "@macroderek",
  "text": "Powell was selected as FOMC Chair for the whole of 2026 until there is a successor: per FOMC Minutes. Powell remains FOMC Chair in June, etc., if he stays on as Governor Powell AND a new Fed Chair (Warsh) remains pending.",
  "url": "https://x.com/macroderek/status/2024200027476734394",
  "platform": "x",
  "likes": 0,
  "retweets": 0,
  "created_at": "2026-02-19 13:13:26",
  "is_real": true,
  "post_date": null
}
```

---

## Task 3: Frontend Component Review

### StoryDetail.tsx — ✅ NO ISSUES

- Renders `viewpoint.social_posts.map(...)` with **no filtering** — all posts shown
- No `likes > 0` filter or `is_real` filter suppressing real posts
- Posts with `likes: 0` (which all real posts currently have) are displayed correctly
- Shows "Supporting Posts on 𝕏" section when `social_posts.length > 0`
- Correct graceful fallback: "Analysis unavailable" shown when viewpoint has no posts

**No fixes required.**

### StoryCard.tsx — ✅ NO ISSUES

- Does not render individual social posts (by design — it's a card)
- Shows `SentimentBar` component using sentiment scores from viewpoints
- No filtering issues

**No fixes required.**

### lib/db.ts — ✅ API Fetch Note

The `getAllStories` function fetches **all** social_posts (real + generated) via:
```sql
SELECT * FROM social_posts WHERE viewpoint_id = ? ORDER BY likes DESC
```
Since all current posts for politics stories are real (`is_real = 1`), this is a non-issue. If generated posts were ever mixed in, the UI would show them too — but the component correctly passes through `is_real` for any future client-side logic.

---

## Recommendations for Follow-Up

1. **`author` field = handle** — The `author` field is currently set to the same value as `author_handle` (e.g., `"@macroderek"` for both). Consider populating `author` with the display name if xAI returns it, for richer UI display.

2. **`likes: 0` on all real posts** — Real posts have 0 likes/retweets. This is likely because the xAI pipeline doesn't fetch engagement metrics from X API. Currently fine since no likes filter exists in UI, but worth noting for future data quality.

3. **`post_date: null`** — The `post_date` field is NULL for all current real posts. Could be populated from the X post timestamp for sorting/display purposes.

4. **Story 346 missing left/right posts** — The Olympics story has no left or right perspective posts. This is a data gap from xAI analysis, not a system failure. Consider re-running xAI for that story or broadening the search query.

5. **No filtering by `is_real` in API** — The API returns all posts regardless of `is_real`. Consider adding `?postsFilter=real` query param for future use cases where only verified posts should be shown.

---

## Overall Status: ✅ ALL CLEAR

The 37 real xAI posts are correctly stored, correctly served by the API, and correctly rendered by the frontend without any suppression or filtering issues.
