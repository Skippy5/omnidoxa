#!/bin/bash
set -e

# Fetch fresh stories
npx tsx scripts/fetch-stories.ts

# Temporarily move API routes out of the way for static export
mv src/app/api src/app/_api_backup

# Build static site
GITHUB_PAGES=true NEXT_PUBLIC_BASE_PATH=/omnidoxa npm run build

# Restore API routes
mv src/app/_api_backup src/app/api

echo "✅ Static build complete! Output in ./out/"
