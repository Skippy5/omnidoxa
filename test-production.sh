#!/bin/bash
echo "🧪 Testing Vercel Production API..."
echo ""
echo "Testing: https://omnidoxa.vercel.app/api/generate-static"
echo ""

SECRET="cb7d35d0794990a6d8fff96828b0b3541ea2d908904ea4316f3076d570c4001c"

curl -s "https://omnidoxa.vercel.app/api/generate-static?secret=$SECRET" > test-response.json

# Check what we got
if grep -q "Unauthorized" test-response.json; then
  echo "❌ ERROR: Unauthorized"
  echo "   → GENERATE_SECRET not set in Vercel, or value is wrong"
  echo ""
  cat test-response.json
elif grep -q "success" test-response.json; then
  STORY_COUNT=$(cat test-response.json | grep -o '"total":[0-9]*' | grep -o '[0-9]*')
  echo "✅ SUCCESS! API returned $STORY_COUNT stories"
  echo ""
  echo "First 200 chars of response:"
  head -c 200 test-response.json
  echo ""
else
  echo "❓ Unexpected response:"
  cat test-response.json
fi

rm test-response.json
