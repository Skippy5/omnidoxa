# Application Architecture

## Current Folder Structure

The application uses the following route and module structure as of Phase 3.

```text
src/app/
  layout.tsx
  page.tsx
  globals.css
  topics/
    [id]/
      page.tsx
  admin/
    page.tsx
  briefing/
    page.tsx
  games/
    page.tsx
  pricing/
    page.tsx
  api/
    admin/
      articles/
        preview/
          route.ts
      topics/
        route.ts
        [id]/
          material-updates/
            route.ts
src/components/
  layout/
  topics/
  admin/
  briefing/
  game/
  ui/
src/lib/
  access.ts
  admin-access.ts
  admin-topics.ts
  article-fetcher.ts
  auth.ts
  db.ts
  grok.ts
  schema.ts
  text-processing.ts
src/types/
docs/database/
  schema.sql
```

## Route Groups

## API Areas

- Public Topics: free Topic layer and locked metadata.
- Premium Topics: full Viewpoints and verified Social Posts.
- Admin Topics: article preview, draft creation, material updates, queue, analyze, review, publish, hide, reanalyze.
- Member/Briefing: profile, briefing, preferences.
- Game: Viewpoint Battle rounds.
- Pipeline: future automation.

## Module Areas

- `src/lib/db.ts`: Turso client.
- `src/lib/schema.ts`: TypeScript entities.
- `src/lib/grok.ts`: xAI/Grok adapter.
- `src/lib/article-fetcher.ts`: metadata extraction.
- `src/lib/text-processing.ts`: URL/title normalization and hashing.
- `src/lib/admin-access.ts`: temporary Phase 3 admin-token gate and intake throttles.
- `src/lib/admin-topics.ts`: Admin Topic preview, duplicate candidates, draft creation, Material Updates, and queue DTOs.
- `src/lib/auth.ts`: Clerk helpers.
- `src/lib/access.ts`: Member/Admin/Subscriber checks.
- `src/components/`: layout, topics, admin, briefing, game.
