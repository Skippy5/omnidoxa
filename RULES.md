# OmniDoxa Implementation Instructions

## Operating Rule

Build OmniDoxa in phases. Keep every phase working before moving on. Do not jump ahead into automation, custom AI briefings, or multi-platform social posts until the manual workflow is stable.

## Required Reading Before Coding

1. `AGENTS.md`
2. `docs/CONTEXT.md`
3. `docs/PROJECT_PLAN.md`
4. `docs/TASKS.md`
5. `docs/APPLICATION_STRUCTURE.md`
6. Relevant ADRs in `docs/adr/`

## Current Phase

Phase 3: Admin Topic Creation.

Immediate tasks:

1. Build SSRF-aware article metadata fetching.
2. Normalize URLs, hashes, titles, and slugs.
3. Propose editable Central Development text from Anchor Article metadata.
4. Build Admin preview, draft Topic creation, Material Update, and queue APIs.
5. Build the `/admin` Anchor Article intake and queue UI.
6. Protect Phase 3 admin APIs with the temporary `OMNIDOXA_ADMIN_TOKEN` gate until Clerk/Admin grants are implemented.

## Non-Negotiables

- Topic-first model.
- Anchor Article creates the Topic.
- Central Development is explicit and editable before analysis.
- Social Posts must be real, URL-backed, and directly relevant.
- Evidence Threshold is enforced by OmniDoxa, not by Grok.
- Admins can edit Editorial Summaries, but cannot edit Social Post text.
- Original AI output is preserved.
- Premium Analysis must not leak to anonymous visitors or free Members.
- Admin access is invitation-based and separate from Subscriber status.
- Daily Briefing requires Member login.
- Custom Briefing Requests are later, not Phase 1-6.

## Verification Expectations

- Run lint, type checks, tests, and browser checks appropriate to the phase.
- Verify dark and light modes for every UI task.
- Verify access boundaries with anonymous, Member, Subscriber, and Admin states once auth exists.
- Verify public APIs do not expose Premium Analysis before subscriber authorization exists.

## Documentation Expectations

- Update `docs/CONTEXT.md` only for product language.
- Add ADRs only for hard-to-reverse tradeoff decisions.
- Keep `docs/TASKS.md` current when task order or acceptance criteria change.
- Keep `docs/ARCHITECTURE.md` current when routes, schema, or service boundaries change.
