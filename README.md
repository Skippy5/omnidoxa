# OmniDoxa

OmniDoxa is a topic-first news intelligence platform for understanding how public discourse forms around important stories. The product starts with an Anchor Article, creates a persistent Topic, analyzes Left, Center, and Right Viewpoints, and presents verified Social Posts that show how real people are responding outside a user's usual information bubble.

## Current Status

This repository has been simplified for the rebuild. The committed root is intentionally small: operating rules, agent workflow, env template, `docs/`, and the application scaffold. Local-only archive material may exist under `archive/`.

Phase 1 is complete: Next.js scaffold, folder structure, minimal app shell, theme foundation, Turso schema, and Vercel readiness.

Production shell: https://omnidoxa.vercel.app/

## Product Layers

- Free Topic layer: headline, Anchor Article link, Neutral Topic Summary, and Discourse Preview.
- Premium Analysis: full Left, Center, and Right Viewpoints plus verified Social Posts.
- Basic Briefing: registered Member briefing with limited static modules.
- Premium Briefing: Subscriber briefing with expanded stocks, stories, AI analysis, and later custom Briefing Requests.
- Engagement Features: games such as Viewpoint Battle that use published Topics without exposing full Premium Analysis.

## Tech Stack

| Area | Choice |
| --- | --- |
| Web app | Next.js 16, React 19 |
| Styling | Tailwind CSS v4, dark/light from day one |
| Database | Turso/libSQL |
| AI analysis | xAI/Grok behind provider adapters |
| Auth | Clerk identity plus OmniDoxa authorization |
| Payments | Stripe subscriptions |
| Hosting | Vercel |
| Email | Resend |

## Root Files

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Agent roles and operating rules |
| `RULES.md` | Non-negotiables, phase discipline, and verification expectations |
| `.env.example` | Required environment variable names |
| `.env.local` | Local environment values |
| `docs/` | Product plan, architecture, design, task list, ADRs, and schema |
| `archive/` | Local-only retired planning packages, generated files, prototypes, and helpers |

## Start Here

1. Read `AGENTS.md` and `RULES.md`.
2. Read `docs/CONTEXT.md`, `docs/PROJECT_PLAN.md`, `docs/TASKS.md`, and `docs/APPLICATION_STRUCTURE.md`.
3. Work only on the current phase unless a decision record changes the plan.
4. Keep the manual Anchor Article workflow working before adding automation.
5. Preserve the free vs Premium Analysis boundary in APIs and UI.
6. Keep Social Post evidence real, URL-backed, and reviewable.
