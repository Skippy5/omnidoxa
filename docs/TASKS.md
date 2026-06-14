# OmniDoxa Tasks

## Immediate Next Tasks

- [x] Phase 1.1: Initialize Next.js 16 project with TypeScript, React 19, and Tailwind CSS v4.
- [x] Phase 1.2: Create folder structure from `docs/APPLICATION_STRUCTURE.md`.
- [x] Phase 1.3: Build a minimal app shell page.
- [x] Phase 1.4: Build theme system with dark mode default and light mode toggle.
- [x] Phase 1.5: Create `.env.example` with phase-marked variables.
- [x] Phase 1.6: Set up Turso schema and typed entities.
- [x] Phase 1.7: Deploy empty shell to Vercel.
- [x] Phase 2.1: Build public Navbar, Footer, category navigation, TopicCard, and TopicHero.
- [x] Phase 2.2: Build SentimentBar, SentimentCard, SocialPostCard, and locked premium panels.
- [x] Phase 2.3: Build home page with placeholder Topics.
- [x] Phase 2.4: Build Topic detail page with Neutral Topic Summary, Discourse Preview, and Anchor Article link.
- [x] Phase 2.5: Verify dark/light theme foundation and responsive public layouts.
- [x] Phase 3.1: Build article metadata fetcher with conservative SSRF protections.
- [x] Phase 3.2: Build URL normalization, URL hashing, title normalization, and slug utilities.
- [x] Phase 3.3: Propose editable Central Development text from Anchor Article metadata.
- [x] Phase 3.4: Build Admin article preview API with Duplicate Candidate warnings.
- [x] Phase 3.5: Build Admin draft Topic creation and Material Update APIs.
- [x] Phase 3.6: Build Admin queue API and `/admin` intake UI.
- [x] Phase 3.7: Add temporary deployed Admin API access gate.
- [x] Phase 4.1: Build xAI Responses/Grok client and prompt contract.
- [x] Phase 4.2: Parse and validate JSON analysis responses.
- [x] Phase 4.3: Store raw Analysis Runs, Viewpoints, and Candidate Social Posts.
- [x] Phase 4.4: Add Admin analyze and review APIs.
- [x] Phase 4.5: Wire Admin sentiment run and Editorial Review controls.
- [x] Phase 4.6: Enforce the Evidence Threshold before review Topics can publish.
- [x] Phase 5.1: Build Admin publish/hide APIs.
- [x] Phase 5.2: Wire Admin publish/hide controls.
- [x] Phase 5.3: Build public Topic list/detail APIs.
- [x] Phase 5.4: Connect public pages to live published Topic data.
- [x] Phase 5.5: Publish skipped-Phase-4 Topics with temporary placeholder analysis.
- [x] Phase 5.6: Remove fake placeholder Topic articles from live public pages.
- [x] Phase 5.7: Add main page, category feed, and promoted main story placement controls.
- [x] Phase 5.8: Use captured Anchor Article images for public Topic art.
- [x] Phase 5.9: Split Archive from Hide so archived Topics remain directly viewable while hidden Topics are fully removed from public access.
- [x] Phase 6.1: Install Clerk and add Next.js 16 `proxy.ts`/`ClerkProvider` identity plumbing behind env detection.
- [x] Phase 6.2: Build OmniDoxa Member/Admin access helpers with admin email allowlist grant bootstrap.
- [x] Phase 6.3: Remove the visible Admin token/password field from `/admin` and gate the console by invited account when Clerk is configured.
- [x] Phase 6.4: Build Basic Briefing configuration UI and member preference API.
- [x] Phase 6.5: Split `/admin` into Article Desk and Access sections.
- [x] Phase 6.6: Build Admin email access overrides for Basic, free Premium, and Admin grants.
- [ ] Phase 6.7: Configure Clerk production keys and `OMNIDOXA_ADMIN_EMAILS` on Vercel.
- [x] Phase 6.8: Retire temporary token fallback.
- [ ] Phase 6.9: Build Stripe checkout and subscription state.
- [ ] Phase 6.10: Unlock Premium Analysis for Subscribers only.
- [ ] Phase 6.11: Choose and integrate weather and market data providers.

## Phase 1 Acceptance

- `npm run dev` starts without errors.
- Theme toggle switches dark/light modes.
- Folder structure matches architecture.
- DB connection can run a simple query.
- Vercel deployment loads successfully.

## Phase 2 Acceptance

- Home page presents a Topic-first editorial feed from placeholder data.
- Topic detail pages are statically generated from placeholder Topics.
- Free Topic layer includes Central Development, Neutral Topic Summary, Discourse Preview, and Anchor Article link.
- Premium Analysis surfaces are visible but locked, with redacted Social Post evidence previews.
- `npm run lint` and `npm run build` pass.
- Browser verification found no console errors or horizontal overflow on desktop or mobile public pages.

## Phase 3 Acceptance

- Admin can submit a public HTTP/HTTPS Anchor Article URL and receive metadata.
- URL ingestion rejects local/private hosts, credentials, non-default ports, non-HTTP schemes, oversized responses, excessive redirects, and non-HTML responses.
- Admin can edit Topic title, category, and Central Development before saving.
- Saving creates one draft Topic and one anchor article row.
- Duplicate Candidates are shown as warnings and never auto-merged.
- Admin can attach a submitted article as a Material Update to a selected existing Topic.
- Admin queue lists persisted Topic summaries, anchor source metadata, and Material Update counts.
- Production admin APIs require Clerk identity plus an active OmniDoxa Admin grant before any article fetch or write begins.
- Public placeholder Topic data is removed from live pages, and Premium Analysis remains unavailable.
- `npm run lint` and `npm run build` pass.
- Browser verification covers `/admin` in dark and light modes.

## Phase 4 Acceptance

- Admin can run xAI/Grok analysis from the Topic queue.
- Analysis uses the xAI Responses API with `web_search` and `x_search`.
- Raw provider output is preserved in `topic_analysis_runs`.
- Versioned Left, Center, and Right Viewpoints are inserted for the active Analysis Version.
- Candidate Social Posts are stored with X/Twitter status URLs and remain editable only through review status.
- Editorial Review can verify/reject Candidate Social Posts and edit editorial summaries.
- Topics in `review` cannot publish until at least two verified Social Posts exist for each Left, Center, and Right Viewpoint.
- Approved analysis moves the Topic to `pending_publish`.
- `npm run lint` and `npm run build` pass.

## Phase 5 Acceptance

- Admin can publish a draft, pending publish, or hidden Topic from `/admin`; review Topics must satisfy the Evidence Threshold first.
- Admin can publish a Topic to the main page, category feed, both placements, or both plus promoted main story.
- Admin can update a published Topic's main/category/promoted placement without hiding it.
- Admin can archive a Topic to remove it from browse feeds while keeping the detail page viewable by slug.
- Admin can hide a Topic so public list and detail APIs no longer return it.
- Publishing fills missing free-layer summaries with temporary placeholder analysis from Topic and Anchor Article metadata.
- Admin can hide a published Topic from `/admin`.
- Public Topic APIs return only `status = 'published'` Topics and apply placement filters.
- Public detail APIs return `published` or `archived` Topics by slug and return 404 for `hidden` Topics.
- Public pages render live published data only; empty feeds show an empty state instead of fake articles.
- Public Topic cards, heroes, and detail images use the captured Anchor Article image when available.
- Public responses do not include full Viewpoint text, Social Post text, raw AI output, or subscriber-only analysis.
- `npm run lint` and `npm run build` pass.
- Browser verification covers `/`, a live/fallback Topic detail page, and `/admin` in dark and light modes.

## Phase 6 Acceptance

- Clerk identity is configured through `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
- Admin access is invitation/email based through OmniDoxa authorization, not a visible password field.
- `OMNIDOXA_ADMIN_EMAILS` can bootstrap active Admin grants for signed-in matching emails.
- Admins can add email-based Basic, free Premium, and Admin access overrides from `/admin/access`.
- Email-based access can be configured before the invitee has signed in.
- Admin APIs still enforce server-side authorization before article fetches, Topic writes, and publish actions.
- Members can configure Basic Briefing location, stock watchlist, news topics, and delivery time preferences.
- Briefing UI works in dark and light modes and does not imply provider-backed weather or market delivery before providers are selected.
- Premium Analysis remains locked for anonymous visitors and free Members until Stripe/subscriber checks are implemented.
- `npm run lint` and `npm run build` pass.

## Phase Map

1. Scaffold and foundation.
2. Public editorial layout with temporary placeholder data. Placeholder data is no longer used by live Phase 5 pages.
3. Admin Anchor Article feed-in.
4. Grok analysis and Editorial Review. Implemented after Phase 5 and before subscription unlock.
5. Publish flow and live frontend.
6. Auth, subscription unlock, and Basic Briefing. In progress.
7. Viewpoint Battle.
8. Automation and expansion.

For detailed workstream planning, use `docs/PROJECT_PLAN.md`.
