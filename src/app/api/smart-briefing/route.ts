import { NextResponse } from 'next/server';

const NEWSDATA_KEY = process.env.NEWSDATA_API_KEY || '';
const XAI_KEY = process.env.XAI_API_KEY || '';

export async function POST(request: Request) {
  try {
    const { topic } = await request.json();

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    // TODO: Add premium authentication check here
    // For now, allow all requests

    // Search Newsdata.io for news articles
    const searchUrl = `https://newsdata.io/api/1/latest?apikey=${NEWSDATA_KEY}&q=${encodeURIComponent(topic)}&language=en&size=10`;
    
    const searchRes = await fetch(searchUrl, {
      headers: { 'Accept': 'application/json' }
    });

    if (!searchRes.ok) {
      throw new Error(`Newsdata API error: ${searchRes.status}`);
    }

    const searchData = await searchRes.json();
    const newsArticles = searchData.results || [];

    // Convert to our format
    const newsResults = newsArticles.slice(0, 8).map((article: any) => ({
      title: article.title,
      description: article.description || article.content?.substring(0, 200),
      url: article.link,
      source: article.source_name || article.source_id,
      published: article.pubDate
    }));

    if (newsResults.length === 0) {
      return NextResponse.json({
        analysis: {
          summary: `No recent news coverage found for "${topic}". This tool focuses on current news and events. Try Wikipedia or Grok for general information.`,
          key_developments: ['No recent news articles found'],
          analysis: `There are no recent news stories about "${topic}" in our news sources. This may not be a currently newsworthy topic, or it may be too specific. Try a broader search term.`,
          implications: 'No active news coverage for this topic.',
          key_players: []
        },
        newsResults: []
      });
    }

    // Build news context for Grok
    const newsText = newsResults.map((r: any, i: number) => 
      `${i + 1}. ${r.title}\n   ${r.description || ''}\n   Source: ${r.source} (${r.published})`
    ).join('\n\n');

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const prompt = `Create a comprehensive NEWS briefing on: "${topic}"

Today's date: ${today}

Recent news articles:
${newsText}

Provide a detailed briefing with helpful context and analysis:

{
  "summary": "2-3 sentence overview of recent developments",
  "key_developments": ["Development 1", "Development 2", "Development 3"],
  "analysis": "2-3 paragraphs analyzing the news. Include helpful background context to explain WHY this matters.",
  "implications": "What these recent developments mean for the future",
  "key_players": ["Entity/Company 1", "Entity/Company 2", "Entity/Company 3"]
}

Be informative and insightful. Provide context that helps readers understand the significance.`;

    const grokRes = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-4',
        messages: [
          { role: 'system', content: 'You are an expert news analyst. Provide insightful analysis with helpful context and background.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 1500
      })
    });

    const grokData = await grokRes.json();
    const content = grokData.choices[0].message.content;
    const jsonMatch = content.match(/```json\n([\s\S]+?)\n```/) || content.match(/(\{[\s\S]+\})/);
    const analysis = JSON.parse(jsonMatch ? jsonMatch[1] : content);

    return NextResponse.json({ analysis, newsResults });
  } catch (error: any) {
    console.error('Smart Briefing error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate briefing' }, { status: 500 });
  }
}
