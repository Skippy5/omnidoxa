# OmniDoxa Project Review - October 11, 2026

## Review Findings

These are code-review findings, ordered by launch impact. They are based on the local checkout at `c47cd45`, not on a fresh authenticated production test. No application behavior was changed during this review.

1. **P1: Reanalysis changes published content before Editorial Review.** `src/lib/admin-topics.ts:1258` preserves published/archived status during a new run, while `src/lib/admin-topics.ts:1400` immediately replaces the Topic's analysis pointer and free summaries with pending AI output. Public reads in `src/lib/public-topics.ts:146` use those summaries without requiring approval. Approved Premium content also disappears while the active pointer references the pending run. Keep separate pending and published snapshots, and promote only after review. Board item ED-01.
2. **P1: Verified evidence cannot be withdrawn through review.** `src/lib/admin-topics.ts:1675` only updates selected posts to verified; `src/lib/admin-topics.ts:1690` explicitly preserves previously verified status even when unchecked. Removing a mistaken verification therefore leaves it counted and publicly eligible for Premium. The UI offers checkboxes, but not a working withdrawal/rejection path. Add explicit audited transitions and recompute approval atomically. Board item ED-02.
3. **P1: Approved Analysis Versions can be edited in place.** `src/lib/admin-topics.ts:1605` accepts further reviews of an approved version, and `src/lib/admin-topics.ts:1664` updates its Viewpoint summaries in place. Original AI output is retained, but the approved editorial snapshot and subsequent edits are not immutable. Freeze approved versions and create a new revision for corrections, retaining actor and reason. Board item ED-03.
4. **P1: AI requests lack durable cost and concurrency controls.** `src/lib/admin-access.ts:8` keeps limits in process memory. `src/lib/admin-topics.ts:1172` reads MAX(version)+1 before a provider call; two concurrent runs can choose the same version, both spend money, then one fails the database UNIQUE constraint. The analyze route authenticates correctly but has no durable per-Topic execution claim. Add a durable lease/reservation, idempotency, and spend limits. Board items SEC-03 and ED-04.
5. **P1: Admin grant removal is incomplete.** `src/lib/access.ts:37` only adds env-bootstrap grants; it does not revoke them when the email leaves the list. `src/lib/access-overrides.ts:132` returns early when there is no matching override, and revocation elsewhere only targets `access_override:` grants. Grants remain attached to the member after a Clerk email change. Define grant authority and add a revocation flow that cannot immediately regrant a revoked user. Board item SEC-01.
6. **P2: Lifecycle guards can be bypassed through other Admin actions.** `src/lib/admin-topics.ts:767` only blocks publishing a Topic whose current status is `review`. Hide/archive can move it out of that status, after which publish no longer checks approval. Deleted Topics are excluded from the queue, but publish and analysis load by ID without rejecting deleted status. All paths remain Admin-only; this is a workflow integrity problem. Enforce allowed transitions and evidence checks independently of the status label. Board item ED-05.
7. **P2: Evidence validation accepts non-post URLs and duplicate evidence.** `src/lib/grok.ts:233` accepts any URL on X/Twitter hosts without enforcing HTTPS or a numeric status permalink. `src/lib/admin-topics.ts:1459` counts verified rows rather than distinct normalized post IDs, and the schema has no per-version post uniqueness rule. Profile URLs or repeated copies of one post can be counted as evidence. Board item ED-06.
8. **P2: Request validation has concrete gaps.** `src/app/api/admin/topics/[id]/publish/route.ts:34` ignores the JSON body when Content-Length is missing. Body limits across routes only inspect that header, and mutating routes have no explicit Origin/JSON content-type validation. Existing Clerk protection must still be considered when assessing exploitability; this review does not establish a working CSRF exploit. Board item SEC-04.
9. **P2: Several launch controls are still missing.** `next.config.ts` has no application security headers; request paths still perform schema DDL; errors are classified by message text; no automated tests or CI workflows were found. The Admin layout still returns `isAdmin: true` when Clerk is absent (`src/app/admin/layout.tsx:15`), although Admin APIs now fail closed. Board items SEC-02, SEC-05, SEC-07, and QA-01 through QA-04.
10. **P2: Public UI promises unfinished behavior.** `src/app/pricing/page.tsx` is blank, while the Topic page's Download PDF Report link points there. The Topic page shows a hard-coded "Neutral-High III" analytical label, and the locked panel promises versioned history without a reader history surface. These need a product decision or working implementation before launch. Board item ED-08.

## Where We Left Off

The last local commit is `c47cd45` (June 20, 2026), "Add admin story management table." Its main change replaced the Admin queue sidebar with a filterable table, date visibility, row actions, and audit-preserving soft deletion.

Before that, June 14 commits completed/preserved Phase 6, removed the token fallback, added analysis of published Topics, retained failed provider responses, unlocked Premium rendering for effective Premium access, refined influential-post prompts, and improved review/error messaging.

The checkout started clean on `main`. It matches the locally cached `origin/main` reference; no network fetch was performed, so this does not prove the remote is still identical. The earlier warning that Phase 6 was entirely uncommitted is resolved by commit `1397292` and later commits. The instruction to retire the token fallback is resolved by `ef54167`.

The practical next milestone is a reliable, tested editorial workflow followed by Phase 7 Payments And Account. Phase 6's identity, Admin access, and preference features are implemented. They still need the hardening and regression coverage described above.

## Current Phase Status

| Phase | Status | Implemented | Still Remaining |
| --- | --- | --- | --- |
| 1. Foundation | Implemented; prior deployment recorded | Next.js, React, TypeScript, Tailwind, Turso schema, env template, theme, Vercel setup | Fresh deployment/service health verification |
| 2. Public editorial UI | Implemented | Topic feed/detail, categories, sentiment components, dark/light foundation | Fresh responsive/accessibility checks; unfinished public actions |
| 3. Manual Topic intake | Implemented | Metadata fetch, normalized URL/hash, duplicate warnings, Central Development, draft creation, Material Updates | Fetch hardening and regression tests |
| 4. AI and review | Implemented with correctness gaps | Grok adapter, parsing, raw response retention, candidate evidence, review, threshold | Pending/published isolation, evidence correction, immutable approval, concurrency, distinct evidence |
| 5. Publishing | Implemented; production acceptance open | Publish/hide/archive, placements, live free data, source images | Production end-to-end verification; transition guards |
| 6. Identity/Admin/preferences | Implemented; hardening open | Clerk, Member/Admin mapping, email overrides, Admin sections/table/delete, saved briefing preferences | Grant revocation/lifecycle, missing-auth UI behavior, tests |
| 7. Payments/account | Partial | Effective Premium entitlement and approved Premium rendering on Topic pages; comped grants | Stripe checkout/webhooks, account/billing UI, access regression suite |
| 8. Live briefings | Preferences only | Location, tickers, categories, delivery-time persistence | Providers, live modules, timezone/scheduler, email, tier limits |
| 9. Engagement | Not implemented | Blank games route exists | Viewpoint Battle APIs, game logic/UI, leakage controls |
| 10. Expansion | Not implemented | Manual duplicate warnings already exist | Automated discovery, automation matching, article bias, more social platforms, custom briefing requests |

Do not treat a route file or a database column as a completed feature. In particular, pricing and games pages are empty, and briefing preferences do not generate or deliver a briefing.

## Corrections To Older Reviews And Plans

- Phase 6 commit and token retirement are complete; remove those cards from the remaining backlog.
- Production Clerk configuration is marked complete in TASKS.md. Treat that as recorded prior completion, pending fresh verification, rather than claiming it was checked today.
- Premium access is partially implemented: the Topic server page passes `access.isSubscriber` to `getPublicTopicBySlug`; access includes comped Premium overrides. The public JSON detail endpoint continues to use the free default. Stripe-paid acquisition is absent.
- PROJECT_PLAN.md still calls Phase 4 deferred despite its checked tasks. RULES.md similarly says Phase 4 is deferred and Premium is locked for all. README.md understates implementation progress. ARCHITECTURE.md describes reject controls and strict status URLs that the current implementation does not supply.
- The previous wildcard-escaping finding is not supported: `titleFingerprint()` removes both `%` and `_` before the LIKE query. Do not carry it forward as a fix. Advisory same-source matching may still be noisy and belongs in later matching quality work.
- The earlier timeout mismatch no longer applies: Grok now times out at 45 seconds and the analyze route declares 60 seconds.
- Failed provider HTTP/parse/timeout responses are now retained through `GrokAnalysisError` where available. A complete execution ledger for transport errors, cancellation, and storage failures is still useful.
- Oversized article bodies are truncated rather than rejected, and a missing Content-Type is accepted. The docs' stricter fetch claims need reconciliation.

## Verification And Limits

- `npm run lint`: passed on October 11, 2026.
- `npm run build`: passed, including TypeScript and route generation.
- No automated test script, application test files, or GitHub Actions workflows were found.
- Read the planning/architecture docs, schema/migration paths, identity/access code, Admin workflow, provider parsing/fetch code, public/Premium read paths, and briefing preferences; traced API authorization call sites and major UI entry points.
- No new live Grok call, payment, database migration, production publish, or authenticated browser workflow was performed.
- Production keys, Clerk account settings, Vercel deployment health, Turso contents, provider quotas, and remote dependency advisories were not verified. No claim about currently safe/latest dependency versions is made.
- Security review is static. Public Premium reads appear gated at existing call sites, but anonymous/Member/comped/Subscriber/Admin browser and response tests are still required.

## Suggested Execution Order

1. Reconcile the docs and establish a production acceptance checklist with named test accounts.
2. Fix editorial integrity: pending/published separation, evidence withdrawal, immutable approvals, allowed transitions, and unique evidence.
3. Add meaningful tests/CI and durable AI execution/cost controls; finish grant revocation and request security.
4. Re-run the manual workflow in production and close the acceptance gap.
5. Build Stripe and account management, reusing the existing effective Premium entitlement.
6. Build real briefing data and delivery after provider/tier decisions.
7. Add games, then automation and broader sources once the manual workflow is stable.

See `2026-10-11-kanban-backlog.md` for an import-oriented checklist with task IDs, priority, dependencies, and acceptance criteria.
