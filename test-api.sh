#!/bin/bash
# Test the /api/generate-static endpoint

SECRET="cb7d35d0794990a6d8fff96828b0b3541ea2d908904ea4316f3076d570c4001c"

echo "🧪 Testing API endpoint..."
echo ""

# Test local first
echo "1️⃣ Testing LOCAL (http://localhost:3000)..."
curl -s "http://localhost:3000/api/generate-static?secret=$SECRET" | head -100
echo ""
echo ""

# Test production
echo "2️⃣ Testing PRODUCTION (https://omnidoxa.vercel.app)..."
curl -s "https://omnidoxa.vercel.app/api/generate-static?secret=$SECRET" | head -100
echo ""
echo ""

echo "✅ If you see JSON with stories above, the API works!"
echo "❌ If you see 'Unauthorized' or error, check GENERATE_SECRET in Vercel env vars"
