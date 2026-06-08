# AGENTS.md - OmniDoxa Rebuild

OmniDoxa uses Skippy's standard agent workflow. Every meaningful change is planned, challenged, implemented, verified, and documented with scope appropriate to risk.

## Core Agent Flow

### Simple Work

Small bug fixes, copy changes, narrow UI tweaks:

1. Planner
2. Coder
3. Tester verification in final summary

### Moderate Work

New feature, small refactor, API change, UI workflow:

1. Planner
2. Challenger
3. Designer
4. Coder
5. Tester
6. Docs if behavior changed

### Complex Work

Architecture, multi-file feature, data model, auth, payments, AI workflows, deployment:

1. Planner
2. Challenger
3. Designer
4. Coder
5. Tester
6. Security
7. Docs

Security has veto power for auth, payments, public endpoints, AI-cost endpoints, secret handling, SSRF, unsafe fetches, and data exposure.

## Core Agents

### Planner

Defines the smallest useful outcome, phase discipline, non-goals, dependencies, and acceptance criteria.

### Challenger

Challenges assumptions early: unclear scope, hidden complexity, cost, abuse paths, maintainability, and "sounds easy but isn't" traps.

### Designer

Owns architecture, route boundaries, component boundaries, data flow, service contracts, and UX workflow shape.

### Coder

Implements the approved plan using existing project patterns. Keeps changes scoped and avoids unrelated refactors.

### Tester

Verifies local checks, browser behavior, responsive layouts, access states, API behavior, and known gaps.

### Security

Reviews secrets, SSRF, public endpoint exposure, authz, paid/free boundaries, logging safety, abuse prevention, and AI-cost controls.

### Docs

Updates project memory, architecture notes, task state, setup docs, and release notes when behavior or operating assumptions change.

## OmniDoxa Specialist Review Lenses

These are not always separate agents. Invoke them when the work touches their area.

### Product

Topics, source selection, analysis UX, editorial quality, premium value, reader trust.

### Data

Turso/libSQL schema, migrations, indexes, Analysis Versions, raw AI output retention, query performance.

### Frontend

Premium editorial interface, dark/light mode, responsive quality, briefing UX, loading/error/empty states.

### Backend/API

API routes, workflow execution, article fetching, queue behavior, retries, failure modes.

### AI Integration

Provider adapters, Grok/xAI boundaries, prompts, parsing, validation, latency, cost, fallback behavior.

### Auth

Clerk integration, invited Admin permissions, Member identity, server-side authorization.

### Payments

Stripe checkout, subscription state, Premium Analysis unlocks, paid/free enforcement.

### DevOps

Vercel config, env vars, cron/scheduler setup, migration sequencing, release health.

## Standing OmniDoxa Rules

- Rebuild cleanly from scratch; salvage old OmniDoxa ideas selectively.
- Use Turso/libSQL unless an ADR changes it.
- Use Vercel unless an ADR changes it.
- Keep the model Topic-first.
- Treat Anchor Articles as analysis inputs, not the main public unit.
- Keep Analysis Versions immutable.
- Preserve raw AI output for audit/debugging.
- Keep manual workflows stable before automating them.
- Put provider logic behind adapters.
- Any endpoint that can cost money requires auth and abuse protection.
- Premium Analysis must stay locked for non-subscribers.
- Dark and light modes must work from the first UI phase.
- Security-sensitive changes require Security review before delivery.
