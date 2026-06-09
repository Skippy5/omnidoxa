# OmniDoxa Architecture

OmniDoxa is a Next.js application hosted on Vercel with Turso/libSQL as the primary database, Clerk for identity, Stripe for subscriptions, and xAI/Grok as the first AI analysis provider.

## Architecture Documents

- `INFRASTRUCTURE.md`: deployment topology, external services, and security boundaries.
- `DATABASE.md`: entity relationships, core tables, and data rules.
- `APPLICATION_STRUCTURE.md`: app route structure, API areas, and module boundaries.
- `docs/database/schema.sql`: initial Turso/libSQL schema reference.

## Core Flow

```mermaid
flowchart LR
  A[Admin submits Anchor Article] --> B[Create draft Topic]
  B --> C[Propose Central Development]
  C --> D[Run Grok Analysis]
  D --> E[Store Analysis Version]
  E --> F[Editorial Review]
  F --> G{Evidence Threshold met?}
  G -- No --> F
  G -- Yes --> H[Pending Publish]
  H --> I[Published Topic]
  I --> J[Free Topic Layer]
  I --> K[Subscriber Premium Analysis]
```

## Data Boundary

Public APIs return only:

- Topic title and metadata
- Neutral Topic Summary
- Discourse Preview
- Anchor Article link
- Locked Premium Analysis metadata

Subscriber-only APIs return:

- Full Left, Center, and Right Viewpoints
- Verified Social Posts
- Historical Analysis Versions when enabled

Admin APIs return:

- Draft and review state
- Candidate Social Posts
- Raw AI output references
- Queue and lifecycle controls

## Infrastructure Boundary

```mermaid
flowchart LR
  Users[Visitors / Members / Subscribers] --> App[Vercel Next.js App]
  Admins[Invited Admins] --> AdminUI[Protected /admin]
  AdminUI --> App
  App --> DB[(Turso libSQL)]
  App --> Clerk[Clerk]
  App --> Stripe[Stripe]
  App --> Grok[xAI Grok]
  App --> Email[Resend]
  App --> Data[Weather / Market / News Providers]
```

## Implementation Notes

- Keep route handlers small and typed.
- Keep provider-specific logic behind adapters.
- Store raw AI output in `topic_analysis_runs`.
- Never edit Social Post text.
- Enforce Premium Analysis access server-side.
- Keep Basic Briefing provider choices explicit before implementation.

## Phase 2 Public UI

- Public home and Topic detail pages currently render from `src/lib/placeholder-topics.ts`.
- Shared public layout components live in `src/components/layout/`.
- Public Topic UI components live in `src/components/topics/`.
- Locked Premium Analysis panels show redacted evidence previews only; no full Viewpoint or Social Post text is exposed in the placeholder public layer.

## Phase 3 Admin Topic Creation

- `/admin` is the manual Anchor Article intake desk and draft Topic queue.
- `POST /api/admin/articles/preview` authenticates the Admin request, fetches article metadata, normalizes the URL, hashes it, proposes Central Development text, and returns Duplicate Candidates without writing.
- `GET /api/admin/topics` returns an Admin queue DTO with Topic summary, anchor source metadata, and Material Update counts.
- `POST /api/admin/topics` creates a draft Topic plus anchor `topic_articles` row when the Admin chooses `create_new`, or attaches the article as a Material Update when the Admin chooses `attach_material_update`.
- `POST /api/admin/topics/[id]/material-updates` fetches a URL and attaches it to an existing Topic as a Material Update.
- Duplicate detection is advisory. It uses exact normalized URL hash matches plus title/source similarity and requires an explicit Admin decision before any write.
- Phase 3 uses the existing `topics`, `topic_articles`, and `topic_updates` tables. No schema change was required.
- Phase 3 deployed Admin APIs require `OMNIDOXA_ADMIN_TOKEN` until Clerk identity and OmniDoxa Admin grants are implemented.
- Article fetching rejects credentials, non-default ports, local/private hosts, reserved IP ranges, non-HTTP schemes, excessive redirects, oversized responses, and non-HTML responses before metadata extraction.
