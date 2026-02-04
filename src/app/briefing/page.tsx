'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Stock {
  symbol: string;
  name: string;
}

interface NewsTopic {
  heading: string;
}

interface BriefingConfig {
  weather: {
    enabled: boolean;
    location: string;
  };
  market: {
    enabled: boolean;
  };
  stocks: {
    enabled: boolean;
    watchlist: Stock[];
  };
  news: {
    enabled: boolean;
    topics: NewsTopic[];
  };
  personal: {
    name: string;
    email: string;
  };
  delivery: {
    enabled: boolean;
    time: string;
  };
}

const DEFAULT_CONFIG: BriefingConfig = {
  weather: {
    enabled: true,
    location: 'Woodstock, GA',
  },
  market: {
    enabled: true,
  },
  stocks: {
    enabled: true,
    watchlist: [],
  },
  news: {
    enabled: true,
    topics: [],
  },
  personal: {
    name: '',
    email: '',
  },
  delivery: {
    enabled: false,
    time: '08:00',
  },
};

export default function BriefingPage() {
  const [config, setConfig] = useState<BriefingConfig>(DEFAULT_CONFIG);
  const [showPreview, setShowPreview] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);

  // Load config from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('omnidoxa-briefing-config');
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load config:', e);
      }
    }
  }, []);

  // Save config to localStorage
  const saveConfig = () => {
    localStorage.setItem('omnidoxa-briefing-config', JSON.stringify(config));
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 3000);
  };

  // Reset to defaults
  const resetConfig = () => {
    if (confirm('Reset all settings to defaults?')) {
      setConfig(DEFAULT_CONFIG);
      localStorage.removeItem('omnidoxa-briefing-config');
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 3000);
    }
  };

  // Add stock to watchlist
  const addStock = () => {
    if (config.stocks.watchlist.length >= 10) {
      alert('Maximum 10 stocks allowed');
      return;
    }
    setConfig({
      ...config,
      stocks: {
        ...config.stocks,
        watchlist: [...config.stocks.watchlist, { symbol: '', name: '' }],
      },
    });
  };

  // Remove stock from watchlist
  const removeStock = (index: number) => {
    setConfig({
      ...config,
      stocks: {
        ...config.stocks,
        watchlist: config.stocks.watchlist.filter((_, i) => i !== index),
      },
    });
  };

  // Update stock in watchlist
  const updateStock = (index: number, field: 'symbol' | 'name', value: string) => {
    const updated = [...config.stocks.watchlist];
    updated[index][field] = value;
    setConfig({
      ...config,
      stocks: { ...config.stocks, watchlist: updated },
    });
  };

  // Add news topic
  const addTopic = () => {
    if (config.news.topics.length >= 5) {
      alert('Maximum 5 topics allowed');
      return;
    }
    setConfig({
      ...config,
      news: {
        ...config.news,
        topics: [...config.news.topics, { heading: '' }],
      },
    });
  };

  // Remove news topic
  const removeTopic = (index: number) => {
    setConfig({
      ...config,
      news: {
        ...config.news,
        topics: config.news.topics.filter((_, i) => i !== index),
      },
    });
  };

  // Update news topic
  const updateTopic = (index: number, value: string) => {
    const updated = [...config.news.topics];
    updated[index].heading = value;
    setConfig({
      ...config,
      news: { ...config.news, topics: updated },
    });
  };

  // Generate preview HTML
  const generatePreview = () => {
    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const time = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    let html = `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 20px; background: #f9f9f9; color: #333; }
  .header { background: linear-gradient(135deg, #1a365d, #2563eb); color: white; padding: 24px; border-radius: 8px; margin-bottom: 24px; }
  .header h1 { margin: 0 0 4px 0; font-size: 26px; }
  .header p { margin: 0; opacity: 0.85; font-size: 14px; }
  h2 { color: #1a365d; border-bottom: 2px solid #2563eb; padding-bottom: 6px; margin-top: 28px; font-size: 18px; }
  .weather-box { background: #e8f4fd; padding: 16px; border-radius: 8px; margin: 12px 0; border-left: 4px solid #2563eb; }
  .weather-box .temp-big { font-size: 36px; font-weight: bold; color: #1a365d; }
  .weather-box .details { color: #555; margin-top: 8px; line-height: 1.6; }
  .futures-row { display: flex; gap: 12px; margin: 12px 0; flex-wrap: wrap; }
  .future-card { flex: 1; min-width: 150px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
  .future-card .name { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .future-card .price { font-size: 18px; font-weight: bold; margin: 4px 0; }
  .future-card .change { font-size: 13px; font-weight: 600; }
  .positive { color: #16a34a; }
  .negative { color: #dc2626; }
  .stock-card { background: #fff; padding: 14px; margin: 8px 0; border-radius: 6px; border-left: 4px solid #2563eb; }
  .stock-card .name { font-weight: bold; color: #1a365d; font-size: 15px; }
  .stock-card .symbol { color: #666; font-size: 13px; }
  .stock-card .price { font-size: 18px; font-weight: bold; margin: 6px 0; }
  .news-section { margin-top: 12px; }
  .news-section h3 { color: #1a365d; font-size: 15px; margin: 16px 0 8px 0; }
  .news-item { background: #fff; padding: 12px; margin: 8px 0; border-radius: 6px; border-left: 3px solid #94a3b8; }
  .news-item a { color: #2563eb; text-decoration: none; font-weight: 600; font-size: 14px; }
  .news-item .desc { color: #555; font-size: 13px; margin-top: 4px; line-height: 1.4; }
  .news-item .source { color: #94a3b8; font-size: 11px; margin-top: 4px; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; text-align: center; }
</style>
</head>
<body>

<div class="header">
  <h1>☀️ Good Morning${config.personal.name ? `, ${config.personal.name}` : ''}</h1>
  <p>${date} &bull; Generated at ${time}</p>
</div>`;

    // Weather section
    if (config.weather.enabled) {
      html += `\n<h2>🌤️ Weather — ${config.weather.location}</h2>
<div class="weather-box">
  <div class="temp-big">72°F</div>
  <div style="font-size: 16px; color: #444; margin-top: 2px;">Partly Cloudy</div>
  <div class="details">
    <strong>High:</strong> 78°F &nbsp;|&nbsp; <strong>Low:</strong> 65°F<br>
    <strong>Feels Like:</strong> 70°F &nbsp;|&nbsp; <strong>Humidity:</strong> 55%<br>
    <strong>Wind:</strong> 8 mph NW &nbsp;|&nbsp; <strong>Rain Chance:</strong> 20%
  </div>
</div>`;
    }

    // Market futures
    if (config.market.enabled) {
      html += `\n<h2>📊 Market Futures Overview</h2>
<p style="color: #444; font-style: italic; margin: 8px 0 16px 0; line-height: 1.5;">U.S. stock futures are mixed to slightly positive ahead of today's open.</p>
<div class="futures-row">
  <div class="future-card">
    <div class="name">S&P 500</div>
    <div class="price">5,842.50</div>
    <div class="change positive">+0.35%</div>
  </div>
  <div class="future-card">
    <div class="name">Dow Jones</div>
    <div class="price">42,315.75</div>
    <div class="change negative">-0.12%</div>
  </div>
  <div class="future-card">
    <div class="name">Nasdaq</div>
    <div class="price">20,450.25</div>
    <div class="change positive">+0.48%</div>
  </div>
</div>`;
    }

    // Stock watchlist
    if (config.stocks.enabled && config.stocks.watchlist.length > 0) {
      html += `\n<h2>📈 Your Stock Watchlist</h2>`;
      config.stocks.watchlist.forEach((stock) => {
        if (stock.symbol && stock.name) {
          const mockPrice = (Math.random() * 200 + 50).toFixed(2);
          const mockChange = (Math.random() * 4 - 2).toFixed(2);
          const isPositive = parseFloat(mockChange) >= 0;
          html += `
<div class="stock-card">
  <div class="name">${stock.name}</div>
  <div class="symbol">${stock.symbol}</div>
  <div class="price">$${mockPrice} <span class="change ${isPositive ? 'positive' : 'negative'}">${isPositive ? '+' : ''}${mockChange}%</span></div>
</div>`;
        }
      });
    }

    // News sections
    if (config.news.enabled && config.news.topics.length > 0) {
      html += `\n<h2>📰 News Briefing</h2>`;
      config.news.topics.forEach((topic) => {
        if (topic.heading) {
          html += `\n<div class="news-section">
  <h3>${topic.heading}</h3>
  <div class="news-item">
    <a href="#">Sample headline about ${topic.heading.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase()}</a>
    <div class="desc">This is a sample news description. In the real briefing, this would show actual news articles from today.</div>
    <div class="source">example.com</div>
  </div>
  <div class="news-item">
    <a href="#">Another ${topic.heading.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase()} story for your briefing</a>
    <div class="desc">Another sample description showing how news items will appear in your daily briefing.</div>
    <div class="source">newssite.com</div>
  </div>
</div>`;
        }
      });
    }

    html += `\n<div class="footer">
  <p>Generated by OmniDoxa Daily Briefing</p>
  <p>This is a preview with sample data. Actual briefings will contain real-time information.</p>
</div>
</body>
</html>`;

    return html;
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-md"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in srgb, var(--bg) 95%, transparent)',
        }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
              <Link href="/" className="hover:opacity-80 transition-opacity">
                Omni<span className="text-purple-400">Doxa</span>
              </Link>
            </h1>
            <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--text-faint)' }}>
              Daily Briefing Configuration
            </p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card-bg)',
              color: 'var(--text-secondary)',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to News
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--text)' }}>
            Build Your Perfect Morning Briefing
          </h2>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            Customize your daily AI-powered briefing with the sections that matter to you.
          </p>
        </div>

        {/* Save/Reset buttons */}
        <div className="mb-8 flex gap-3 flex-wrap">
          <button
            onClick={saveConfig}
            className="flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-semibold transition-all hover:scale-105"
            style={{
              borderColor: '#2563eb',
              background: '#2563eb',
              color: 'white',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Save Configuration
          </button>
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-semibold transition-all hover:scale-105"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card-bg)',
              color: 'var(--text)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Preview Briefing
          </button>
          <button
            onClick={resetConfig}
            className="flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-medium transition-all"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card-bg)',
              color: 'var(--text-secondary)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
            </svg>
            Reset to Defaults
          </button>
        </div>

        {/* Configuration sections */}
        <div className="space-y-6">
          {/* Weather */}
          <div
            className="rounded-lg border p-6"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card-bg)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <span>☀️</span> Weather
              </h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.weather.enabled}
                  onChange={(e) =>
                    setConfig({ ...config, weather: { ...config.weather, enabled: e.target.checked } })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            {config.weather.enabled && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Location (city, state or zip)
                </label>
                <input
                  type="text"
                  value={config.weather.location}
                  onChange={(e) =>
                    setConfig({ ...config, weather: { ...config.weather, location: e.target.value } })
                  }
                  placeholder="Woodstock, GA"
                  className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                  }}
                />
              </div>
            )}
          </div>

          {/* Market Overview */}
          <div
            className="rounded-lg border p-6"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card-bg)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <span>📊</span> Market Overview
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  S&P 500, Dow, Nasdaq futures
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.market.enabled}
                  onChange={(e) =>
                    setConfig({ ...config, market: { ...config.market, enabled: e.target.checked } })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Stock Watchlist */}
          <div
            className="rounded-lg border p-6"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card-bg)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <span>📈</span> Stock Watchlist
              </h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.stocks.enabled}
                  onChange={(e) =>
                    setConfig({ ...config, stocks: { ...config.stocks, enabled: e.target.checked } })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            {config.stocks.enabled && (
              <div className="space-y-3">
                {config.stocks.watchlist.map((stock, i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <input
                      type="text"
                      value={stock.symbol}
                      onChange={(e) => updateStock(i, 'symbol', e.target.value.toUpperCase())}
                      placeholder="Symbol (e.g., AAPL)"
                      className="flex-1 px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{
                        borderColor: 'var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                      }}
                    />
                    <input
                      type="text"
                      value={stock.name}
                      onChange={(e) => updateStock(i, 'name', e.target.value)}
                      placeholder="Company name"
                      className="flex-[2] px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{
                        borderColor: 'var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                      }}
                    />
                    <button
                      onClick={() => removeStock(i)}
                      className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                    </button>
                  </div>
                ))}
                {config.stocks.watchlist.length < 10 && (
                  <button
                    onClick={addStock}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-all hover:scale-105"
                    style={{
                      borderColor: 'var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    Add Stock ({config.stocks.watchlist.length}/10)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* News Topics */}
          <div
            className="rounded-lg border p-6"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card-bg)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <span>📰</span> News Topics
              </h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.news.enabled}
                  onChange={(e) =>
                    setConfig({ ...config, news: { ...config.news, enabled: e.target.checked } })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            {config.news.enabled && (
              <div className="space-y-3">
                {config.news.topics.map((topic, i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <input
                      type="text"
                      value={topic.heading}
                      onChange={(e) => updateTopic(i, e.target.value)}
                      placeholder="Topic (e.g., 🏛️ Politics, 💻 AI & Tech)"
                      className="flex-1 px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{
                        borderColor: 'var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                      }}
                    />
                    <button
                      onClick={() => removeTopic(i)}
                      className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                    </button>
                  </div>
                ))}
                {config.news.topics.length < 5 && (
                  <button
                    onClick={addTopic}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-all hover:scale-105"
                    style={{
                      borderColor: 'var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    Add Topic ({config.news.topics.length}/5)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Personal Info */}
          <div
            className="rounded-lg border p-6"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card-bg)',
            }}
          >
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4" style={{ color: 'var(--text)' }}>
              <span>👤</span> Personal Info
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Name
                </label>
                <input
                  type="text"
                  value={config.personal.name}
                  onChange={(e) =>
                    setConfig({ ...config, personal: { ...config.personal, name: e.target.value } })
                  }
                  placeholder="Your name"
                  className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={config.personal.email}
                    onChange={(e) =>
                      setConfig({ ...config, personal: { ...config.personal, email: e.target.value } })
                    }
                    placeholder="your@email.com"
                    className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{
                      borderColor: 'var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                    }}
                  />
                  <span
                    className="absolute right-3 top-2.5 text-xs px-2 py-1 rounded"
                    style={{ background: 'var(--badge-bg)', color: 'var(--text-muted)' }}
                  >
                    Coming soon: email delivery
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Schedule */}
          <div
            className="rounded-lg border p-6 opacity-60"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card-bg)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <span>⏰</span> Delivery Schedule
                </h3>
                <span
                  className="inline-block mt-2 text-xs px-3 py-1 rounded-full"
                  style={{ background: '#f59e0b', color: 'white' }}
                >
                  Coming Soon
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-not-allowed">
                <input type="checkbox" disabled className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-600 rounded-full opacity-50"></div>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Delivery Time
              </label>
              <input
                type="time"
                disabled
                value={config.delivery.time}
                className="w-full px-4 py-2 rounded-lg border opacity-50 cursor-not-allowed"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Bottom save button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={saveConfig}
            className="flex items-center gap-2 rounded-lg border px-8 py-4 text-base font-semibold transition-all hover:scale-105"
            style={{
              borderColor: '#2563eb',
              background: '#2563eb',
              color: 'white',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Save Configuration
          </button>
        </div>
      </main>

      {/* Preview Modal */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--overlay-bg)' }}
          onClick={() => setShowPreview(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] rounded-lg border overflow-hidden flex flex-col"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--modal-bg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
                Briefing Preview
              </h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 rounded-lg hover:bg-gray-500/20 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <iframe
                srcDoc={generatePreview()}
                className="w-full h-full min-h-[600px]"
                title="Briefing Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* Save Toast */}
      {showSaveToast && (
        <div
          className="fixed bottom-8 right-8 px-6 py-4 rounded-lg border shadow-lg flex items-center gap-3 animate-slide-up"
          style={{
            borderColor: '#10b981',
            background: 'var(--card-bg)',
            color: 'var(--text)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="font-medium">Configuration saved!</span>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
