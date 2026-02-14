# Reddit API Setup for OmniDoxa

## What You Need to Do (5 minutes)

### Step 1: Create Reddit App

1. **Go to:** https://www.reddit.com/prefs/apps
2. **Click:** "Create App" or "Create Another App" (bottom of page)
3. **Fill in the form:**
   - **Name:** OmniDoxa News Analysis
   - **App type:** Select **"script"** (radio button)
   - **Description:** Political sentiment analysis from Reddit discussions
   - **About URL:** (leave blank)
   - **Redirect URI:** http://localhost
4. **Click:** "Create app"

### Step 2: Copy Your Credentials

After creating, you'll see:

```
OmniDoxa News Analysis
personal use script by YourUsername

[YOUR_CLIENT_ID]          <-- This is under the app name (14 characters)
secret [YOUR_CLIENT_SECRET]  <-- Click "secret" to reveal
```

**Copy these 4 things:**
1. **Client ID** (under app name)
2. **Client Secret** (next to "secret")
3. **Your Reddit username**
4. **Your Reddit password**

### Step 3: Give to Skippy

Paste all 4 into Telegram, formatted like:
```
Client ID: abc123xyz
Client Secret: xyz789abc123
Username: YourRedditUsername
Password: YourRedditPassword
```

## Why Reddit?

✅ **Free** - No payment required
✅ **Real data** - Actual people's opinions
✅ **Political subreddits** - Clear left/right/center sources
✅ **Active discussions** - More substance than tweets
✅ **Stable API** - Won't randomly break

## What We'll Get

For each news article, we'll pull:
- 3-5 posts from **r/politics** (left perspective)
- 3-5 posts from **r/Conservative** (right perspective)
- 3-5 posts from **r/NeutralPolitics** or **r/moderatepolitics** (center)

Each will show:
- Username (u/username)
- 1-2 sentence summary
- Link to actual Reddit post
- Upvote score
- Which subreddit (shows political lean)

---

**That's it!** Once you give me the credentials, I'll integrate it into OmniDoxa and we'll have REAL social commentary. 🍺
