#!/bin/bash
###############################################################################
# OmniDoxa Local News Fetch - Cron Wrapper
# Runs the news aggregation script and logs output
###############################################################################

set -euo pipefail

# Project paths
PROJECT_DIR="$HOME/Projects/omnidoxa"
SCRIPT="$PROJECT_DIR/scripts/fetch-news-local.ts"
LOG_DIR="$PROJECT_DIR/logs/cron"
LOG_FILE="$LOG_DIR/fetch-$(date +%Y-%m-%d).log"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Log start
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >> "$LOG_FILE"
echo "🚀 OmniDoxa News Fetch - Started at $(date)" >> "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >> "$LOG_FILE"

# Change to project directory
cd "$PROJECT_DIR"

# Run the fetch script using tsx (TypeScript executor)
if npx tsx "$SCRIPT" >> "$LOG_FILE" 2>&1; then
  echo "✅ Fetch completed successfully at $(date)" >> "$LOG_FILE"
  exit 0
else
  echo "❌ Fetch failed at $(date)" >> "$LOG_FILE"
  exit 1
fi
