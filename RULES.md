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

Phase 6: Auth, Admin Access, And Basic Briefing Preferences.

Phase 4 AI Analysis And Editorial Review is intentionally deferred. Until that
phase is implemented, published Topics may use temporary free-layer placeholder
analysis generated from Anchor Article and Topic metadata. Premium Analysis
remains locked and public APIs must not return full Viewpoint text or Social
Post text.

Immediate tasks:

1. Keep Admin Anchor Article intake stable while moving from token access to Clerk/Admin grants.
2. Integrate Clerk identity with OmniDoxa-owned Member, Subscriber, and Admin authorization.
3. Bootstrap invited Admin access from configured email addresses.
4. Keep Admin authorization server-side before article fetches, Topic writes, and publish actions.
5. Build Basic Briefing preferences for logged-in Members.
6. Keep Premium Analysis locked until the separate Payments And Account section implements subscriber unlock.
7. Keep live weather, market, and delivery work in the separate Briefing Data And Delivery section.
8. Verify dark and light modes for all Phase 6 UI.

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
