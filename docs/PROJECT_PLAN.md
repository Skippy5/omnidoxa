# OmniDoxa Project Plan

## Objective

Build a topic-first news intelligence platform where Anchor Articles become persistent Topics, public discourse is analyzed across Left, Center, and Right Viewpoints, and Subscribers unlock verified Premium Analysis and briefing features.

## Workstreams

### 1. Scaffold And Foundation

Outcome: deployable Next.js shell with theme support, folder structure, environment documentation, and Turso connectivity.

- [ ] Initialize Next.js 16, React 19, TypeScript, Tailwind CSS v4.
- [ ] Create the planned folder structure from `docs/APPLICATION_STRUCTURE.md`.
- [ ] Build a minimal app shell page so the project has a visible surface.
- [ ] Build dark/light theme provider and toggle on the minimal shell.
- [ ] Create `.env.example`.
- [ ] Apply initial Turso schema and typed entities.
- [ ] Deploy empty shell to Vercel.

### 2. Public Editorial Experience

Outcome: polished placeholder UI with free Topic layer and locked Premium Analysis states.

- [x] Build Navbar, Footer, category navigation, TopicCard, and TopicHero.
- [x] Build SentimentBar, SentimentCard, SocialPostCard, and locked premium panels.
- [x] Build home page with placeholder Topics.
- [x] Build Topic detail page with Neutral Topic Summary, Discourse Preview, and Anchor Article link.
- [x] Verify dark/light modes and responsive layouts.

### 3. Admin Topic Creation

Outcome: invited Admins can submit Anchor Articles and create draft Topics.

- [ ] Build article metadata fetcher.
- [ ] Build URL normalization, hashing, title normalization, and slug utilities.
- [ ] Propose Central Development from Anchor Article metadata.
- [ ] Build Admin Submit API with Duplicate Candidate warnings.
- [ ] Build Material Update API.
- [ ] Build Admin Queue API and UI.

### 4. AI Analysis And Editorial Review

Outcome: Admins can run Grok analysis, review candidates, preserve raw output, and publish only threshold-satisfying Topics.

- [ ] Build Grok client and prompt contract.
- [ ] Parse and validate analysis responses.
- [ ] Store raw AI output in Analysis Runs.
- [ ] Insert versioned Viewpoints and Candidate Social Posts.
- [ ] Build Editorial Review UI/API.
- [ ] Enforce Evidence Threshold before publish readiness.

### 5. Publish Flow And Live Data

Outcome: reviewed Topics appear publicly without leaking Premium Analysis.

- [ ] Build publish/hide APIs.
- [ ] Wire Admin publish/hide controls.
- [ ] Build public Topic list/detail APIs.
- [ ] Connect public pages to real data.
- [ ] Verify end-to-end manual workflow.

### 6. Auth, Subscriptions, And Basic Briefing

Outcome: Members, Subscribers, and Admins have separate access paths; Basic Briefing exists for Members.

- [ ] Integrate Clerk.
- [ ] Build OmniDoxa authorization mapping.
- [ ] Build Stripe checkout and subscription state.
- [ ] Unlock Premium Analysis for Subscribers.
- [ ] Choose weather and market data providers.
- [ ] Build Basic Briefing for logged-in Members.

### 7. Engagement Features

Outcome: Viewpoint Battle uses published data without exposing full Premium Analysis.

- [ ] Build game topic and submit APIs.
- [ ] Rebuild Viewpoint Battle against the new Topic/Viewpoint model.
- [ ] Build games page.

### 8. Post-Launch Expansion

Outcome: automated discovery, richer platforms, article bias, Premium Briefing expansion, and custom AI sections.

- [ ] Add automated discovery providers.
- [ ] Add duplicate/topic candidate detection.
- [ ] Add article-level bias analysis.
- [ ] Add Reddit and Bluesky Social Posts.
- [ ] Expand Premium Briefing and custom Briefing Requests.

## Milestones

| Milestone | Done When |
| --- | --- |
| M1 Deployable Shell | App runs, deploys, theme toggles, DB connects. |
| M2 Editorial UI | Placeholder public pages work in dark/light modes. |
| M3 Draft Topic Creation | Admin can submit Anchor Article and create draft Topic. |
| M4 Reviewed Analysis | Grok output enters Editorial Review and threshold rules work. |
| M5 Public Free Layer | Published Topics show free layer and locked Premium Analysis. |
| M6 Auth And Paid Unlock | Member, Subscriber, and Admin access paths work. |
| M7 Basic Briefing | Logged-in Members can access Basic Briefing. |
| M8 Viewpoint Battle | Game uses published Viewpoint Excerpts. |
| M9 Automation Ready | Automated inputs feed the same reviewed workflow. |

## Open Questions

- [ ] Which weather provider should Basic Briefing use?
- [ ] Which market/stock data provider should Basic and Premium Briefing use?
- [ ] What exact Basic vs Premium briefing limits should apply?
- [ ] How should first-version Admin invitations be created?
- [ ] Should early Social Post verification include URL fetch checks or remain human-only?
- [ ] What is the first production domain target?
