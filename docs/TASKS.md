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
- [x] Phase 3.7: Add temporary admin-token access gate for deployed Phase 3 APIs.

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
- Production admin APIs require `OMNIDOXA_ADMIN_TOKEN` before any article fetch or write begins.
- Public placeholder pages remain unchanged, and Premium Analysis remains unavailable.
- `npm run lint` and `npm run build` pass.
- Browser verification covers `/admin` in dark and light modes.

## Phase Map

1. Scaffold and foundation.
2. Public editorial layout with placeholder data.
3. Admin Anchor Article feed-in.
4. Grok analysis and Editorial Review.
5. Publish flow and live frontend.
6. Auth, subscription unlock, and Basic Briefing.
7. Viewpoint Battle.
8. Automation and expansion.

For detailed workstream planning, use `docs/PROJECT_PLAN.md`.
