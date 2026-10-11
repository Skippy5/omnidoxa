# OmniDoxa Remaining Work - October 11, 2026

## Objective

Finish a reliable Topic-first editorial product, enable paid and comped Premium access, deliver real Member briefings, then expand into engagement and reviewed automation.

This is a remaining-work snapshot for import, not a replacement for existing completed cards. All unchecked cards start as To Do; dependency fields describe sequencing rather than claiming a task is blocked. P1 means before paid launch; P2 means required for its feature milestone; P3 means later expansion. Owners are suggested review lenses, not assignments to people. Estimates are deliberately omitted.

### Restart And Acceptance

Outcome: one accurate plan and a reproducible path from the current checkout to production acceptance.

- [ ] RS-01 [P1] Reconcile project docs and board statuses with implemented behavior.
  - Owner: Docs / Product.
  - Depends on: none.
  - Scope: README, RULES, PROJECT_PLAN, TASKS, architecture notes, existing board cards.
  - Acceptance: Phase 4 is no longer deferred; Phase 6 commit/token retirement are complete; Premium rendering is partial Phase 7, not absent; briefing is preferences-only; duplicate wildcard escaping is removed as unsupported. Keep the 10-phase map and preserve existing card history.

- [ ] RS-02 [P1] Verify the current production manual workflow and access states.
  - Owner: Tester / DevOps / Security.
  - Depends on: ED-01 through ED-06, SEC-01 through SEC-04, QA-01 through QA-03 for final signoff; baseline inspection can start now.
  - Scope: deployed revision/configuration, Clerk sign-in, intake, Material Update, analysis, review, publish/placement, archive/hide/delete, preferences, and Premium visibility.
  - Acceptance: record deployed SHA and results for anonymous, Member, comped Premium, Subscriber when available, and Admin accounts; verify dark/light desktop/mobile, direct URLs and JSON/RSC responses; retain screenshots and sanitized failures. Close the unchecked Phase 5 production acceptance item only after passing.

- [ ] RS-03 [P1] Recheck dependency and operational readiness after the project pause.
  - Owner: DevOps / Security.
  - Depends on: none.
  - Scope: current dependency advisories/support, lockfile reproducibility, Vercel runtime/configuration, Clerk/Turso/xAI service health, backup and rollback procedure.
  - Acceptance: document actual advisory results without speculative upgrades; apply required fixes with regression checks; verify restore on a safe database copy and document release rollback. Verify service configuration without copying secret values into reports.

### Editorial Correctness

Outcome: published content stays reviewed, evidence is correctable, and approved snapshots remain auditable.

- [ ] ED-01 [P1] Separate pending analysis from the published approved snapshot.
  - Owner: Designer / Data / AI Integration.
  - Depends on: none; coordinate schema with QA-04 and revision rules with ED-03.
  - Scope: runTopicAnalysis, Topic summaries, active/published version selection, public and Premium reads.
  - Acceptance: reanalyzing a published/archived Topic leaves its approved summaries, sentiment, and Premium evidence visible; pending output remains Admin-only; failed analysis leaves publication unchanged; approval promotes the full snapshot atomically. Preserve the deliberately allowed no-analysis free publish path.

- [ ] ED-02 [P1] Add explicit evidence rejection and withdrawal of mistaken verification.
  - Owner: Backend / Frontend / Product.
  - Depends on: ED-03 for correction of approved snapshots.
  - Scope: review API/state, checkbox/action semantics, evidence status transitions and audit.
  - Acceptance: Admin can verify a candidate, reject a candidate, and withdraw mistaken verification; withdrawn evidence no longer counts or appears publicly; threshold and approval are recalculated atomically; post text is never edited; UI accurately reflects persisted state after reload.

- [ ] ED-03 [P1] Freeze approved Analysis Versions and record editorial revisions.
  - Owner: Data / Backend / Security.
  - Depends on: none; coordinate with ED-01.
  - Scope: approval guard, original versus edited summaries, correction versions, reviewer identity and reasons.
  - Acceptance: approved version content cannot be overwritten; later corrections create a new revision with actor/time/reason; original raw AI output and prior approved content remain retrievable for audit; stale review submissions are rejected by expected-version checks.

- [ ] ED-04 [P1] Reserve analysis versions atomically and prevent duplicate paid execution.
  - Owner: Backend / Data / AI Integration.
  - Depends on: coordinate with SEC-03.
  - Scope: MAX(version)+1 allocation, per-Topic run lease, idempotency, completion/failure ledger.
  - Acceptance: simultaneous requests cannot claim one version or trigger duplicate provider work for the same operation; retries are idempotent; leases expire/recover safely; transport/provider/storage failure states are recorded; every available raw response survives rejection without disturbing approved content.

- [ ] ED-05 [P1] Enforce lifecycle transitions and evidence readiness on the server.
  - Owner: Backend / Product / Tester.
  - Depends on: ED-01, ED-03.
  - Scope: publish, review, hide, archive, placement, delete, reanalysis and Material Update actions.
  - Acceptance: hide/archive cannot bypass approval of an analyzed Topic; deleted Topics reject analysis/publish/update actions unless an explicit restore action exists; stale concurrent actions cannot resurrect deleted content; no-analysis placeholder publication remains an explicit documented exception.

- [ ] ED-06 [P1] Require valid distinct Social Post evidence for the threshold.
  - Owner: AI Integration / Data / Product.
  - Depends on: none.
  - Scope: X/Twitter URL normalization, candidate deduplication, threshold counting and review checklist.
  - Acceptance: require supported HTTPS numeric status permalinks; reject profile/search/unsupported-scheme URLs; X/Twitter aliases of one post count once per lean/version; repeated evidence cannot satisfy two-post minimum; define cross-lean reuse and human source/text/relevance checks. Record whether live URL checks are deferred.

- [ ] ED-07 [P2] Make Grok output failures actionable and budget-aware.
  - Owner: AI Integration / Backend.
  - Depends on: ED-04, SEC-03.
  - Scope: current 3000-token budget against 12-18 requested posts, truncation handling, provider errors, timing and usage metadata.
  - Acceptance: use current provider documentation to choose a bounded output contract/budget; distinguish incomplete JSON, invalid evidence, provider outage and timeout; preserve available responses; track duration/model/usage without leaking secrets; any retry has a bounded cost policy.

- [ ] ED-08 [P2] Finish public editorial states and remove misleading actions.
  - Owner: Product / Frontend.
  - Depends on: ED-01; PAY-01 for pricing decisions.
  - Scope: hard-coded analytical label, placeholder explanatory copy, Download PDF Report link, blank pricing destination, history claims, unavailable Premium state.
  - Acceptance: labels come from reviewed data or are omitted; users can distinguish locked access from analysis not yet available; each visible action has a working outcome; PDF/history features are either implemented as separately scoped work or their promises removed; verify dark/light mobile/desktop and accessible controls.

### Security And Authorization

Outcome: access changes take effect reliably and paid/provider endpoints have enforceable protection.

- [ ] SEC-01 [P1] Define and implement Admin grant revocation and identity lifecycle handling.
  - Owner: Auth / Security / Data.
  - Depends on: none.
  - Scope: env-bootstrap grants, email overrides, Clerk email change/deletion, revocation UI and reconciliation/webhook policy.
  - Acceptance: authorized Admins can revoke grants from every source; revoked users are not silently regranted; list removal/email change/deletion follows a documented policy; override revocation still works after email changes; prevent accidental last-Admin lockout; audit actor/reason; verify webhook signatures/idempotency if webhooks are used.

- [ ] SEC-02 [P1] Make Admin UI fail closed when Clerk configuration is absent.
  - Owner: Auth / Frontend.
  - Depends on: none.
  - Scope: admin/layout missing-config branch, API rejection, setup error state.
  - Acceptance: missing/invalid Clerk configuration renders an unavailable/sign-in state rather than the Admin portal; anonymous/Member accounts never get management content; retain server API authorization; no token fallback is reintroduced.

- [ ] SEC-03 [P1] Replace process-local throttling with durable AI and fetch controls.
  - Owner: Backend / DevOps / Security.
  - Depends on: none; coordinate with ED-04.
  - Scope: shared rate limits, concurrent-run claims, per-Admin and global spend caps, timeout/retry budgets.
  - Acceptance: limits hold across multiple instances and cold starts; provider calls are denied before spend when capped; claims expire safely; return actionable retry behavior; test concurrent and retry cases; retain authentication before expensive work.

- [ ] SEC-04 [P1] Add bounded request parsing and mutating-route origin validation.
  - Owner: Backend / Security.
  - Depends on: none.
  - Scope: shared JSON validation, actual byte limits, Origin policy, publish body parsing without Content-Length.
  - Acceptance: valid missing-length JSON preserves placement fields; oversized/malformed/unsupported payloads receive consistent errors; browser mutation origins are verified; document legitimate non-browser callers; define separate webhook handling for signed raw bodies; cover Admin and Member mutation routes.

- [ ] SEC-05 [P2] Add security headers compatible with Clerk and theming.
  - Owner: Frontend / DevOps / Security.
  - Depends on: none.
  - Scope: CSP, frame-ancestors, MIME sniffing, referrer policy and applicable transport/browser policies.
  - Acceptance: test deployed response headers; Clerk sign-in, inline theme initialization, fonts and intended remote images still work; disallowed framing/scripts are blocked; avoid a blanket policy that silently breaks authentication.

- [ ] SEC-06 [P2] Close article-fetch validation gaps before broader intake.
  - Owner: Backend / Security.
  - Depends on: QA-01 tests; mandatory before EXP-01.
  - Scope: DNS validation/fetch resolution, IPv4/IPv6 and mapped addresses, redirect resources, body cap, missing Content-Type.
  - Acceptance: pin or otherwise enforce validated destinations at connection time; block private/reserved targets on every redirect; decide explicit reject versus truncate policy and document it; release redirect bodies; test missing/non-HTML content types, oversized/slow streams and address forms without real network abuse.

- [ ] SEC-07 [P2] Introduce typed errors and useful sanitized operational diagnostics.
  - Owner: Backend / DevOps.
  - Depends on: none.
  - Scope: Admin/Member route status mapping, provider/DB failures, request/run correlation and alerts.
  - Acceptance: expected auth/validation/conflict/rate-limit failures have stable status/code; clients do not receive SQL/provider internals; logs correlate run failures without secrets or raw private payloads; public read outages are distinguishable operationally from a genuinely empty feed/404.

### Tests And Database Operations

Outcome: critical rules are protected by automated checks and database changes are reproducible.

- [ ] QA-01 [P1] Add focused unit tests for normalization, parsing and evidence rules.
  - Owner: Tester / Backend.
  - Depends on: none; add regression cases alongside ED fixes.
  - Scope: URL/title/hash helpers, briefing preferences, Grok parsing, address validation, distinct evidence threshold.
  - Acceptance: test normal/invalid/boundary inputs and previously identified bugs with deterministic fixtures; assert impossible times such as 99:99 are rejected; provider/network calls are mocked; raw evidence text stays unchanged.

- [ ] QA-02 [P1] Add integration and browser access/workflow regression tests.
  - Owner: Tester / Security / Frontend.
  - Depends on: QA-01; expand alongside ED-01 through ED-06 and PAY-04.
  - Scope: isolated test DB, lifecycle APIs, concurrency, identity roles, Premium JSON/HTML/RSC boundaries, dark/light responsive workflows.
  - Acceptance: cover free, comped and paid states independently of Admin status; negative tests exercise hidden/deleted/unreviewed access and cross-member preferences; review corrections and reanalysis keep approved publication intact; tests never require a paid live Grok call or production writes.

- [ ] QA-03 [P1] Add CI gates and a repeatable release checklist.
  - Owner: DevOps / Tester.
  - Depends on: QA-01.
  - Scope: clean install, lint, type/build, automated tests, PR checks and deployment smoke checks.
  - Acceptance: fresh checkout checks run without production secrets; failing tests block the agreed release path; documents identify environment/migration sequencing, rollback, and Security signoff for sensitive work.

- [ ] QA-04 [P1] Replace request-time DDL with versioned migrations and data constraints.
  - Owner: Data / DevOps.
  - Depends on: coordinate schema with ED-01, ED-03, ED-04 and PAY-02.
  - Scope: access/placement schema guards, migration ledger, one preference record per Member, canonical email policy, evidence uniqueness and billing indexes.
  - Acceptance: inspect/deduplicate existing rows before adding constraints; clean and existing DBs migrate reproducibly; requests never CREATE/ALTER tables; test concurrent preference saves; decide email uniqueness deliberately rather than imposing it blindly; migration/restore procedure is documented.

### Phase 7 - Payments And Account

Outcome: Members can buy/manage subscriptions and both paid and comped Premium access work reliably.

- [ ] PAY-01 [P2] Decide the subscription offer and implement pricing states.
  - Owner: Product / Payments / Frontend.
  - Depends on: none.
  - Scope: price/currency/billing interval, included features, cancellation/past-due/trial policy, comped versus paid wording.
  - Acceptance: decisions are explicit; /pricing renders an actual offer with sign-in, active subscription and comped states; no unavailable PDF/history/briefing feature is advertised as delivered.

- [ ] PAY-02 [P2] Add billing persistence and signed idempotent Stripe webhook sync.
  - Owner: Payments / Data / Security.
  - Depends on: PAY-01, QA-04.
  - Scope: Member/customer/subscription mapping, event ledger, allowed price IDs, effective subscription state, retries and event ordering.
  - Acceptance: verify signatures against the raw body; duplicate/out-of-order events cannot corrupt access; map to server-owned Member/customer identity; handle activation, renewal, cancellation, failed payment and deletion; comped overrides remain separate from paid state; cover with webhook fixtures.

- [ ] PAY-03 [P2] Build authenticated Stripe checkout and completion flow.
  - Owner: Payments / Backend / Frontend.
  - Depends on: PAY-01, PAY-02, SEC-03, SEC-04.
  - Scope: server-selected price, customer reuse, idempotent session creation, safe return URLs, confirmation state.
  - Acceptance: signed-in Members can subscribe once; request cannot spoof Member/price/entitlement; duplicate clicks do not create duplicate subscriptions; redirect alone does not grant access; UI waits for authoritative webhook state and handles cancellation/failure.

- [ ] PAY-04 [P2] Complete the existing effective Premium entitlement boundary.
  - Owner: Auth / Backend / Security.
  - Depends on: PAY-02, ED-01, ED-03.
  - Scope: existing access.isSubscriber comped path, new paid state, Premium repository API and cache policy.
  - Acceptance: use one server-owned entitlement calculation; paid or comped users can read approved published/archived analysis; anonymous/free users cannot; Admin status alone does not grant Premium; revocation takes effect predictably; public APIs stay free; new call sites cannot opt into Premium with an untrusted boolean.

- [ ] PAY-05 [P2] Add account status and secure subscription management.
  - Owner: Payments / Auth / Frontend.
  - Depends on: PAY-02, PAY-03, PAY-04.
  - Scope: effective tier/source, renewal/cancellation/payment issue state, Stripe customer portal and account lifecycle.
  - Acceptance: only the current Member can access their billing portal; distinguish comped Premium from a paid subscription; explain pending sync and past-due access accurately; users can update payment/cancel using the defined policy; no billing details leak between Members.

- [ ] PAY-06 [P2] Verify the full payment-to-access lifecycle before accepting live payments.
  - Owner: Tester / Payments / Security.
  - Depends on: PAY-02 through PAY-05, QA-02, QA-03.
  - Scope: Stripe test mode, webhook retries, cancellations, renewals, comped revocation, cache leakage and deployment secrets.
  - Acceptance: test purchase-to-unlock and cancellation-to-lock with real test events; confirm anonymous/free denial in page source and network responses; verify correct environment/price mappings; retain evidence and Security signoff before live release.

### Phase 8 - Briefing Data And Delivery

Outcome: saved preferences produce an actual bounded, reliable briefing.

- [ ] BR-01 [P2] Select the weather provider and location model.
  - Owner: Product / Backend.
  - Depends on: none.
  - Scope: geocoding, coverage, cost, licensing/attribution, update cadence and privacy.
  - Acceptance: provider choice and budget documented from current terms; normalized location supports deterministic weather lookup; define missing/ambiguous-location behavior and credential boundaries.

- [ ] BR-02 [P2] Select market/stock providers and display policy.
  - Owner: Product / Backend.
  - Depends on: none.
  - Scope: exchange coverage, ticker resolution, delayed/realtime licensing, timestamps, cost and quotas.
  - Acceptance: document provider/rights and budget; invalid/delisted/ambiguous tickers behave predictably; displayed prices include source, freshness and applicable delay; define market-closed behavior.

- [ ] BR-03 [P2] Define Basic and Premium briefing limits.
  - Owner: Product / Payments / AI Integration.
  - Depends on: PAY-01.
  - Scope: module availability, stocks/categories/stories limits, refresh/generation frequency, cost caps and delivery eligibility.
  - Acceptance: enforce limits server-side from effective entitlement; explain current hard-coded preference caps; downgrades/comped revocation behave consistently; price and usage model covers external/AI costs.

- [ ] BR-04 [P2] Build server-side briefing provider adapters and shared caching.
  - Owner: Backend / DevOps / Security.
  - Depends on: BR-01, BR-02, BR-03, SEC-03.
  - Scope: weather/markets adapters, normalized DTOs, safe fetches, bounded timeouts/retries, cache/freshness and quotas.
  - Acceptance: credentials stay server-side; shared cache limits repeated provider calls; stale/error/no-data states remain distinguishable; per-Member/global controls prevent unbounded cost; test outages and rate limits with fixtures.

- [ ] BR-05 [P2] Render real Basic Briefing modules from saved preferences.
  - Owner: Frontend / Product / Backend.
  - Depends on: BR-04.
  - Scope: weather, watchlist, published Topic news categories, preference edits and refresh.
  - Acceptance: registered Members see actual data for their settings; timestamps/sources and loading/empty/error/stale states work; hidden/deleted Topics never appear; no Premium evidence leaks; verify dark/light mobile/desktop.

- [ ] BR-06 [P2] Add valid delivery times, timezones and reliable scheduled generation.
  - Owner: Backend / Data / DevOps.
  - Depends on: BR-03, BR-05, QA-04.
  - Scope: current HH:MM-only preferences, IANA timezone, DST, protected scheduler, job ledger and retries.
  - Acceptance: reject impossible times; generate at each Member's intended local time across DST; duplicate scheduler calls do not produce duplicate editions; jobs recover from failures; signed/authenticated scheduling and bounded costs hold across instances.

- [ ] BR-07 [P2] Deliver briefings through Resend and expand eligible Premium modules.
  - Owner: Backend / Product / DevOps.
  - Depends on: BR-03, BR-05, BR-06, PAY-04.
  - Scope: email templates, sending domain, consent/unsubscribe/preferences, bounce handling, delivery ledger, expanded Premium content.
  - Acceptance: one eligible edition sends once; delivery failures retry safely; users can stop delivery; templates render with source links and correct tier; paid/comped downgrade changes future editions; no recipient or Premium content is exposed to the wrong user.

### Phase 9 - Viewpoint Battle

Outcome: an engagement feature uses published excerpts without exposing the full paid record.

- [ ] GAME-01 [P3] Define Viewpoint Battle rules and safe excerpt contracts.
  - Owner: Product / Designer / Security.
  - Depends on: ED-01, ED-03, ED-06.
  - Scope: round selection, attribution timing, scoring, repeat behavior, allowed excerpt size and tier policy.
  - Acceptance: rules are explicit; only approved public-viewable Topics qualify; repeated requests cannot reconstruct full Premium analysis; define no-topic/insufficient-evidence behavior.

- [ ] GAME-02 [P3] Build game topic and answer submission APIs.
  - Owner: Backend / Tester.
  - Depends on: GAME-01, SEC-03.
  - Scope: server-generated rounds, scoring/answer validation, limits and minimal response DTOs.
  - Acceptance: clients cannot spoof score or access hidden/deleted/unapproved content; round replay/guess behavior is bounded; APIs expose only approved limited excerpts; automated tests cover abuse and scoring.

- [ ] GAME-03 [P3] Implement the playable games page.
  - Owner: Frontend / Product / Tester.
  - Depends on: GAME-02.
  - Scope: replace blank /games with round, answer, feedback, results and replay flow.
  - Acceptance: complete game works by keyboard/touch in dark/light mobile/desktop; loading/error/no-content states work; source/topic links respect access policy.

### Phase 10 - Automation And Expansion

Outcome: new sources enter the same safe, reviewed workflow after the manual product is stable.

- [ ] EXP-01 [P3] Add authenticated automated discovery into the draft queue.
  - Owner: Backend / DevOps / AI Integration / Security.
  - Depends on: RS-02, ED-01 through ED-06, SEC-03, SEC-06, QA-03.
  - Scope: provider selection, protected scheduling, idempotent ingestion, retry/backoff and cost/volume limits.
  - Acceptance: discoveries create candidates/drafts rather than publishing; replays do not duplicate inputs; failed sources isolate cleanly; maintain a kill switch, bounded work and human Editorial Review.

- [ ] EXP-02 [P3] Extend advisory duplicate detection for automated Topic matching.
  - Owner: Data / Product / Backend.
  - Depends on: EXP-01.
  - Scope: existing exact URL/title/source warnings, candidate ranking, Material Update suggestions and false-positive evaluation.
  - Acceptance: distinguish one event from broad same-source overlap; preserve Admin choice and original inputs; no automatic merge destroys Topic identity; evaluate representative duplicate/nonduplicate examples before enabling suggestions.

- [ ] EXP-03 [P3] Add article-level bias analysis behind a provider adapter.
  - Owner: Product / AI Integration / Security.
  - Depends on: ED-03, SEC-03.
  - Scope: rubric, article input rights/access, scores/reasons, versioning and display policy.
  - Acceptance: clearly distinguish article bias from sentiment toward the Central Development; preserve raw output, cost caps and review; do not silently replace Topic Viewpoints with article scores.

- [ ] EXP-04 [P3] Add Reddit and Bluesky Social Post adapters.
  - Owner: AI Integration / Backend / Product.
  - Depends on: ED-02, ED-06, SEC-03.
  - Scope: terms/API access, platform identifiers/URLs, normalization, provenance, deduplication and evidence policy.
  - Acceptance: immutable real post text/source identifiers are retained; review and distinct-evidence rules apply across platforms; deleted/unavailable content behavior is documented; no unsupported platform is labeled verified solely by model output.

- [ ] EXP-05 [P3] Add bounded custom Premium Briefing Requests.
  - Owner: Product / AI Integration / Payments / Security.
  - Depends on: PAY-06, BR-03 through BR-07, SEC-03, SEC-06.
  - Scope: request limits, public retrieval/citations, prompt-injection boundary, user isolation, execution cost and saved requests.
  - Acceptance: only eligible paid/comped users invoke generation; inputs cannot request arbitrary internal URLs or escape quotas; results cite sources; retries/cost are bounded; per-user content remains isolated; define review/publication policy for personalized output separately from public Topics.
