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
    access/
      page.tsx
    article-desk/
      page.tsx
    layout.tsx
    page.tsx
  briefing/
    page.tsx
  games/
    page.tsx
  pricing/
    page.tsx
  api/
    briefing/
      preferences/
        route.ts
    topics/
      route.ts
      [id]/
        route.ts
    admin/
      access/
        route.ts
        [id]/
          route.ts
      articles/
        preview/
          route.ts
      topics/
        route.ts
        [id]/
          route.ts
          analysis/
            route.ts
          analyze/
            route.ts
          archive/
            route.ts
          hide/
            route.ts
          material-updates/
            route.ts
          placement/
            route.ts
          publish/
            route.ts
          review/
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
  access-overrides.ts
  admin-access.ts
  admin-topics.ts
  article-fetcher.ts
  auth-config.ts
  auth.ts
  briefing-preferences.ts
  db.ts
  grok.ts
  schema.ts
  topic-schema-guards.ts
  topic-types.ts
  text-processing.ts
src/types/
docs/database/
  schema.sql
```

## Route Groups

## API Areas

- Public Topics: free Topic layer and locked metadata.
- Premium Topics: full Viewpoints and verified Social Posts.
- Admin Topics: article preview, draft creation, material updates, queue, analyze, review, publish, archive, hide, soft delete, placement, reanalyze.
- Admin Access: email-based Basic, free Premium, and Admin access overrides.
- Member/Briefing: profile, briefing, preferences.
- Game: Viewpoint Battle rounds.
- Pipeline: future automation.

## Module Areas

- `src/lib/db.ts`: Turso client.
- `src/lib/schema.ts`: TypeScript entities.
- `src/lib/grok.ts`: xAI Responses API adapter for web/X-search sentiment analysis.
- `src/lib/article-fetcher.ts`: metadata extraction.
- `src/lib/text-processing.ts`: URL/title normalization and hashing.
- `src/lib/auth-config.ts`: Clerk/admin-email environment detection shared by server components and proxy.
- `src/lib/auth.ts`: Clerk identity and OmniDoxa Member profile helpers.
- `src/lib/access.ts`: Member/Admin/Subscriber access-state helpers and Admin grant bootstrap.
- `src/lib/access-overrides.ts`: email-based access override schema guard, reads, writes, and Member/Admin application.
- `src/lib/admin-access.ts`: Admin API access gate backed by Clerk identity, OmniDoxa Admin grants, and intake throttles.
- `src/lib/admin-topics.ts`: Admin Topic preview, duplicate candidates, draft creation, Material Updates, queue DTOs, lifecycle transitions, placement updates, and audit-preserving soft delete.
- `src/lib/public-topics.ts`: Published-only public Topic DTOs, placement-aware reads, and pending free-layer analysis mapping.
- `src/lib/briefing-preferences.ts`: Basic Briefing preference reads, validation, and writes.
- `src/lib/topic-types.ts`: Public Topic DTO types and category navigation constants.
- `src/lib/topic-schema-guards.ts`: Temporary additive guard for Phase 5 placement columns on existing databases.
- `src/components/`: layout, topics, admin, briefing, game.
