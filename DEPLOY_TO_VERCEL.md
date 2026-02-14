# 🚀 Deploy OmniDoxa to Vercel - Final Steps

## Current Status
✅ Code ready  
✅ GitHub Action configured  
✅ API endpoint created  
⏳ **Needs:** Add secrets to GitHub & Vercel

## 3 Simple Steps to Go Live

### Step 1: Add Secret to GitHub
1. Go to https://github.com/Skippy5/omnidoxa/settings/secrets/actions
2. Click **"New repository secret"**
3. Name: `GENERATE_SECRET`
4. Value: `cb7d35d0794990a6d8fff96828b0b3541ea2d908904ea4316f3076d570c4001c`
5. Click **"Add secret"**

### Step 2: Add Secret to Vercel
1. Go to https://vercel.com/skippy5/omnidoxa/settings/environment-variables
2. Click **"Add New"**
3. Key: `GENERATE_SECRET`
4. Value: `cb7d35d0794990a6d8fff96828b0b3541ea2d908904ea4316f3076d570c4001c`
5. Environments: ✅ Production ✅ Preview ✅ Development
6. Click **"Save"**
7. Go to **Deployments** → click **"..."** on latest → **"Redeploy"**

### Step 3: Test It
1. Go to https://github.com/Skippy5/omnidoxa/actions
2. Click **"Fetch News Stories"** workflow
3. Click **"Run workflow"** button → **"Run workflow"**
4. Wait 5 minutes
5. Check https://omnidoxa.vercel.app/ - should load with 50 fresh articles!

## What Happens Next
- ✅ GitHub Action runs at **6 AM & 6 PM daily** (UTC)
- ✅ Fetches 50 fresh articles (10 categories × 5 each)
- ✅ Commits `public/stories.json` to GitHub
- ✅ Vercel auto-deploys with new stories
- ✅ Site loads instantly (static JSON)

## Verify It's Working
After Step 3 completes:
1. Go to https://omnidoxa.vercel.app/
2. Should see **50 articles**
3. All **10 categories** visible (Top, Breaking, Technology, Domestic, etc.)
4. **"Updated X ago"** timestamp in header
5. Click **category filters** - all work!

## Troubleshooting
**If Step 3 fails:**
- Check GitHub Actions log for errors
- Verify GENERATE_SECRET matches in both GitHub & Vercel
- Make sure NEWSDATA_API_KEY exists in Vercel env vars

**If site still shows "Failed to fetch":**
- Wait 1 minute after GitHub Action completes (Vercel needs to deploy)
- Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
- Check https://github.com/Skippy5/omnidoxa/commits - should see bot commit

**Manual fix:**
If automated setup doesn't work, you can generate stories.json manually:
```bash
# Locally
curl "http://localhost:3000/api/generate-static?secret=cb7d35..." -o public/stories.json
git add public/stories.json
git commit -m "Manual news update"
git push
```

## Next Commits
This commit includes:
- ✅ GitHub Action workflow (`.github/workflows/fetch-news.yml`)
- ✅ Static generation API (`/api/generate-static`)
- ✅ Documentation (4 setup guides)
- ✅ 10-category support (top, breaking, technology, domestic, etc.)

After you add the secrets and test, **everything will work automatically!**

---

**Questions?** Check:
- `PRODUCTION_SETUP.md` - Full architecture explanation
- `EASIEST_VERCEL_SETUP.md` - Alternative approaches considered
- GitHub Actions logs - Real-time fetch progress
- Vercel deployment logs - Deploy status
