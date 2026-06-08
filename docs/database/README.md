# OmniDoxa Database

`docs/database/schema.sql` is the canonical Phase 1 Turso/libSQL schema.

Apply it to the configured Turso database with:

```bash
npm run db:apply
```

The command loads local environment values through Next.js env handling and requires real `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` values in `.env.local`.

Keep schema changes append-only and deliberate. Analysis Versions are immutable, raw AI output is retained in `topic_analysis_runs`, and Social Post text must remain audit-safe.
