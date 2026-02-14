# Twitter API v2 Setup Guide

## Step 1: Apply for Twitter Developer Account

**Go to:** https://developer.x.com/en/portal/petition/essential/basic-info

**You'll need:**
1. Twitter/X account (use your existing account)
2. Email verification
3. App details:
   - **App name:** OmniDoxa News Analysis
   - **Use case:** Analyze political sentiment from public tweets for news articles
   - **Description:** "OmniDoxa aggregates news articles and analyzes public sentiment from Twitter/X posts to show left/center/right political perspectives. We search for recent tweets related to news topics and display them with sentiment analysis."

**Form answers:**
- **Will you make Twitter content available to government entities?** NO
- **Will your product, service, or analysis make Twitter content or derived information available to a government entity?** NO
- **Do you plan to analyze Twitter data?** YES - Political sentiment analysis for news articles
- **Will your app use Tweet, Retweet, Like, Follow, or Direct Message functionality?** NO - read-only search
- **Will you display Tweets or Twitter content off Twitter?** YES - on OmniDoxa.com with proper attribution

## Step 2: Create Project & App

Once approved (usually instant for Free tier):

1. **Create Project:**
   - Name: "OmniDoxa"
   - Use case: "Exploring the API"
   - Description: "Political news sentiment analysis"

2. **Create App:**
   - Environment: Production
   - Name: "omnidoxa-sentiment"

3. **Get Keys:**
   - Copy Bearer Token (starts with `AAAA...`)
   - Save it securely

## Step 3: Add to OmniDoxa

**Add to `.env.local`:**
```bash
TWITTER_BEARER_TOKEN=your_bearer_token_here
```

## API Limits (Free Tier)

- **500,000 tweets/month** - More than enough
- **Recent search** - Last 7 days of tweets
- **Rate limit:** 450 requests per 15 min window
- **Cost:** $0 (completely free)

## Next Steps

Once you have the Bearer Token:
1. Add it to `.env.local`
2. I'll build the Twitter search integration
3. Test with 5 articles
4. Deploy! 🚀

---

**Start here:** https://developer.x.com/en/portal/petition/essential/basic-info

Let me know when you have the Bearer Token!
