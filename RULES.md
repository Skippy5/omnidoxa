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

Phase 5: Publish Flow And Live Data.

Phase 4 AI Analysis And Editorial Review is intentionally deferred. Until that
phase is implemented, published Topics may use temporary free-layer placeholder
analysis generated from Anchor Article and Topic metadata. Premium Analysis
remains locked and public APIs must not return full Viewpoint text or Social
Post text.

Immediate tasks:

1. Keep Admin Anchor Article intake stable.
2. Build Admin publish/hide controls and APIs behind `OMNIDOXA_ADMIN_TOKEN`.
3. Publish draft Topics into the public free layer with temporary pending analysis copy.
4. Expose published-only public Topic list/detail data.
5. Route published Topics to the main page, category feed, or promoted main story placement.
6. Use captured Anchor Article images as public Topic art when available.
7. Keep fake placeholder Topics out of live public pages.
8. Archive removes Topics from browse feeds but keeps them directly viewable and future-searchable.
9. Hide removes Topics from public list and detail access.
10. Verify published and archived Topics do not expose Premium Analysis.

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
