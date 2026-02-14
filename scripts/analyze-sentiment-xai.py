#!/usr/bin/env python3
"""
OmniDoxa Sentiment Analysis using xAI SDK with x_search
Analyzes political sentiment (LEFT/CENTER/RIGHT) and fetches REAL tweets
"""

import os
import sys
import json
from xai_sdk import Client
from xai_sdk.chat import system, user
from xai_sdk.tools import x_search

def analyze_sentiment(article_title, article_url):
    """
    Analyze political sentiment for a news article and fetch real tweets
    
    Args:
        article_title: The news article title
        article_url: The news article URL
        
    Returns:
        dict: Sentiment analysis with real tweets
    """
    
    # Ensure API key is set
    if not os.environ.get("XAI_API_KEY"):
        os.environ["XAI_API_KEY"] = "your-xai-api-key-here"
    
    # Create the prompt
    prompt = f"""Analyze the sentiment from the political left, right, and center for the following recent news topic: {article_title}. Base it on this article if provided: {article_url}

Focus on analysis from the past 30 days only. Provide a 3-sentence non-biased review of the topic.

Then, break it down into left, center, and right: a score from -1 (negative) to 1 (positive), 2-3 sentences on how the group feels about the topic, and three example tweets for each left, right, and center to back up the analysis, including the account name, tweet text, and link to each tweet.

Use x_search to find REAL tweets from X/Twitter. Do not fabricate or invent examples."""

    # Initialize client
    client = Client()
    
    # Create chat with x_search tool
    chat = client.chat.create(
        model="grok-4",
        messages=[
            system("You are a helpful assistant. Always use the x_search tool to fetch real tweets from X instead of generating them. Provide sources and avoid fabrication."),
            user(prompt)
        ],
        tools=[x_search()],
        max_turns=10
    )
    
    # Get response
    response = chat.sample()
    content = response.content
    
    # Parse the response to extract structured data
    result = {
        "nonBiasedSummary": "",
        "left": {"sentiment": 0, "summary": "", "tweets": []},
        "center": {"sentiment": 0, "summary": "", "tweets": []},
        "right": {"sentiment": 0, "summary": "", "tweets": []}
    }
    
    # Extract non-biased summary
    import re
    summary_match = re.search(r'### Non-Biased Review[^\n]*\n(.*?)(?=###|$)', content, re.DOTALL)
    if summary_match:
        result["nonBiasedSummary"] = summary_match.group(1).strip()
    
    # Extract left sentiment
    left_match = re.search(r'### Left\s*\n\*\*Score:\*\*\s*([-\d.]+).*?\n(.*?)(?=\*\*Example Tweets)', content, re.DOTALL)
    if left_match:
        result["left"]["sentiment"] = float(left_match.group(1))
        result["left"]["summary"] = left_match.group(2).strip()
    
    # Extract center sentiment
    center_match = re.search(r'### Center\s*\n\*\*Score:\*\*\s*([-\d.]+).*?\n(.*?)(?=\*\*Example Tweets)', content, re.DOTALL)
    if center_match:
        result["center"]["sentiment"] = float(center_match.group(1))
        result["center"]["summary"] = center_match.group(2).strip()
    
    # Extract right sentiment
    right_match = re.search(r'### Right\s*\n\*\*Score:\*\*\s*([-\d.]+).*?\n(.*?)(?=\*\*Example Tweets)', content, re.DOTALL)
    if right_match:
        result["right"]["sentiment"] = float(right_match.group(1))
        result["right"]["summary"] = right_match.group(2).strip()
    
    # Extract tweets for each perspective
    def extract_tweets(section_name):
        tweets = []
        section_pattern = f'### {section_name}.*?\\*\\*Example Tweets:\\*\\*(.*?)(?=###|$)'
        section_match = re.search(section_pattern, content, re.DOTALL)
        
        if section_match:
            tweet_pattern = r'\d+\.\s+\*\*Account:\*\*\s*([^\n]+)\s+\*\*Tweet Text:\*\*\s*([^\n]+)\s+\*\*Link:\*\*\s*(https?://[^\s]+)'
            for match in re.finditer(tweet_pattern, section_match.group(1)):
                tweets.append({
                    "account": match.group(1).strip(),
                    "text": match.group(2).strip(),
                    "url": match.group(3).strip()
                })
        
        return tweets
    
    result["left"]["tweets"] = extract_tweets("Left")
    result["center"]["tweets"] = extract_tweets("Center")
    result["right"]["tweets"] = extract_tweets("Right")
    
    return result

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: analyze-sentiment-xai.py <title> <url>"}))
        sys.exit(1)
    
    title = sys.argv[1]
    url = sys.argv[2]
    
    try:
        result = analyze_sentiment(title, url)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
