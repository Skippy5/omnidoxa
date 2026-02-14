# Vercel Deployment Setup for OmniDoxa

## Problem
- Vercel is serverless (no persistent SQLite files)
- 10-second function timeout (our fetch takes 5+ minutes)
- Read-only filesystem after build

## Solution
Use Vercel Postgres + Cron Jobs

## Steps

### 1. Create Vercel Postgres Database
1. Go to https://vercel.com/skippy5/omnidoxa
2. Click "Storage" tab
3. Click "Create Database" → "Postgres"
4. Name: `omnidoxa-db`
5. Region: `Washington, D.C., USA (iad1)` (closest to your location)
6. Click "Create"

### 2. Connect Database to Project
Vercel will automatically add these environment variables:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL` 
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`

### 3. Set Up Cron Job
1. Create `vercel.json` in project root:
```json
{
  "crons": [
    {
      "path": "/api/cron/fetch-news",
      "schedule": "0 6,18 * * *"
    }
  ]
}
```
This runs at 6 AM and 6 PM daily.

### 4. Deploy
```bash
git add -A
git commit -m "Add Vercel Postgres support + cron job"
git push origin main
```

Vercel auto-deploys and enables the cron job.

## What Happens
- **6 AM & 6 PM daily**: Cron job fetches 50 fresh articles → stores in Postgres
- **Users visit site**: Fast page loads (reads from Postgres, no fetch delay)
- **Manual refresh**: Button triggers immediate fetch (if needed)

## Local Development
Still uses SQLite (`omnidoxa.db`) - no changes needed.
Production uses Postgres automatically via env vars.
