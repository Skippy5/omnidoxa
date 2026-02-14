'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Analysis {
  summary: string;
  key_developments: string[];
  analysis: string;
  implications: string;
  key_players: string[];
}

interface NewsResult {
  title: string;
  description: string;
  url: string;
  source: string;
  published: string;
}

export default function SmartBriefingPage() {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [newsResults, setNewsResults] = useState<NewsResult[]>([]);
  const [error, setError] = useState('');
  
  // TODO: Replace with actual premium check
  const isPremium = true; // For now, allow everyone

  const generateBriefing = async () => {
    if (!topic.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/smart-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate briefing');
      }

      setAnalysis(data.analysis);
      setNewsResults(data.newsResults || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const quickSearch = (searchTopic: string) => {
    setTopic(searchTopic);
    setTimeout(() => generateBriefing(), 100);
  };

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 border border-white/20 text-center">
            <div className="text-6xl mb-6">🔒</div>
            <h1 className="text-4xl font-bold text-white mb-4">Smart Briefing</h1>
            <p className="text-xl text-gray-300 mb-8">
              Get AI-powered deep-dive analysis on any topic with Smart Briefing
            </p>
            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-6 mb-8">
              <div className="text-yellow-400 font-bold mb-2">⭐ Premium Feature</div>
              <p className="text-gray-300">
                Smart Briefing is available to OmniDoxa Premium subscribers only
              </p>
            </div>
            <Link
              href="/pricing"
              className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 px-8 rounded-xl hover:scale-105 transition-transform"
            >
              Upgrade to Premium
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block bg-yellow-500/20 border border-yellow-500/50 rounded-full px-4 py-1 mb-4">
            <span className="text-yellow-400 font-semibold">⭐ Premium Feature</span>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">📰 Smart Briefing</h1>
          <p className="text-xl text-gray-300">AI-powered deep-dive analysis on any topic</p>
        </div>

        {/* Search Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 mb-8">
          <div className="flex gap-4 mb-6">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && generateBriefing()}
              placeholder="Enter any topic (AI, crypto, climate change, etc.)"
              className="flex-1 bg-white/20 border border-white/30 rounded-xl px-6 py-4 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={generateBriefing}
              disabled={loading || !topic.trim()}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold px-8 py-4 rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Generating...' : '📊 Generate'}
            </button>
          </div>

          {/* Quick Topics */}
          <div className="flex flex-wrap gap-3">
            {['Artificial Intelligence', 'Cryptocurrency', 'Climate Change', 'Space Exploration', 'Tech Startups'].map((t) => (
              <button
                key={t}
                onClick={() => quickSearch(t)}
                className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 mb-8">
            <div className="text-red-400 font-bold mb-2">❌ Error</div>
            <p className="text-gray-300">{error}</p>
          </div>
        )}

        {/* Briefing Results */}
        {analysis && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <div className="border-b border-white/20 pb-6 mb-6">
              <h2 className="text-3xl font-bold text-white mb-2">{topic}</h2>
              <p className="text-gray-400">Generated {new Date().toLocaleString()}</p>
            </div>

            {/* Summary */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-purple-400 mb-4">📋 Executive Summary</h3>
              <p className="text-gray-300 text-lg leading-relaxed">{analysis.summary}</p>
            </div>

            {/* Key Developments */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-purple-400 mb-4">🔑 Key Developments</h3>
              <ul className="space-y-3">
                {analysis.key_developments.map((dev, i) => (
                  <li key={i} className="bg-white/5 border-l-4 border-purple-500 rounded-lg p-4 text-gray-300">
                    {dev}
                  </li>
                ))}
              </ul>
            </div>

            {/* Analysis */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-purple-400 mb-4">📊 In-Depth Analysis</h3>
              <p className="text-gray-300 text-lg leading-relaxed whitespace-pre-line">{analysis.analysis}</p>
            </div>

            {/* Key Players */}
            {analysis.key_players.length > 0 && (
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-purple-400 mb-4">🎯 Key Players</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analysis.key_players.map((player, i) => (
                    <div key={i} className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-xl p-4 text-center font-bold text-white">
                      {player}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Implications */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-purple-400 mb-4">🔮 Future Implications</h3>
              <p className="text-gray-300 text-lg leading-relaxed">{analysis.implications}</p>
            </div>

            {/* Skippy Quote */}
            <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-l-4 border-yellow-500 rounded-xl p-6 mb-8">
              <p className="text-lg italic text-gray-300 mb-2">
                "{['Not bad for filthy monkey technology.', 'This data is... adequate.', "I've processed worse.", 'Magnificent analysis, even by my standards.'][Math.floor(Math.random() * 4)]}"
              </p>
              <p className="text-right font-bold text-yellow-400">— Skippy the Magnificent 🍺</p>
            </div>

            {/* News Headlines */}
            {newsResults.length > 0 && (
              <div>
                <h3 className="text-2xl font-bold text-purple-400 mb-4">📰 Recent Headlines</h3>
                <div className="space-y-4">
                  {newsResults.map((article, i) => (
                    <div key={i} className="bg-white/5 rounded-xl p-6 border border-white/10">
                      <h4 className="font-bold text-white mb-2">{article.title}</h4>
                      {article.description && (
                        <p className="text-gray-400 mb-3">{article.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">{article.source} • {article.published}</span>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300 font-medium"
                        >
                          Read more →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Back Link */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-purple-400 hover:text-purple-300">
            ← Back to OmniDoxa
          </Link>
        </div>
      </div>
    </div>
  );
}
