# Application Architecture

## Planned Folder Structure

Create this structure during Phase 1 after the Next.js scaffold exists. Some files can start as placeholders, but the directories should exist so later phases have an agreed home.

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
    topics/
    admin/
    briefing/
    game/
    pipeline/
src/components/
  layout/
  topics/
  admin/
  briefing/
  game/
  ui/
src/lib/
  access.ts
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
- Admin Topics: submit, analyze, review, publish, hide, reanalyze.
- Member/Briefing: profile, briefing, preferences.
- Game: Viewpoint Battle rounds.
- Pipeline: future automation.

## Module Areas

- `src/lib/db.ts`: Turso client.
- `src/lib/schema.ts`: TypeScript entities.
- `src/lib/grok.ts`: xAI/Grok adapter.
- `src/lib/article-fetcher.ts`: metadata extraction.
- `src/lib/text-processing.ts`: URL/title normalization and hashing.
- `src/lib/auth.ts`: Clerk helpers.
- `src/lib/access.ts`: Member/Admin/Subscriber checks.
- `src/components/`: layout, topics, admin, briefing, game.
