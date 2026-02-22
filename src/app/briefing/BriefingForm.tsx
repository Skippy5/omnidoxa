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
    membershipLevel: 'free' | 'basic' | 'premium';
  };
  smartBriefing: {
    enabled: boolean;
    topic: string;
  };
  delivery: {
    enabled: boolean;
    time: string;
  };
}

interface BriefingFormProps {
  initialName?: string;
  initialEmail?: string;
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
    membershipLevel: 'free',
  },
  smartBriefing: {
    enabled: false,
    topic: '',
  },
  delivery: {
    enabled: false,
    time: '08:00',
  },
};

export default function BriefingForm({ initialName = '', initialEmail = '' }: BriefingFormProps) {
  const [config, setConfig] = useState<BriefingConfig>(() => ({
    ...DEFAULT_CONFIG,
    personal: {
      ...DEFAULT_CONFIG.personal,
      name: initialName,
      email: initialEmail,
    },
  }));
  const [showPreview, setShowPreview] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Load config from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('omnidoxa-briefing-config');
    if (saved) {
      try {
        const loadedConfig = JSON.parse(saved);

        // Backward compatibility: merge with defaults for new fields
        const mergedConfig = {
          ...DEFAULT_CONFIG,
          ...loadedConfig,
          personal: {
            ...DEFAULT_CONFIG.personal,
            ...loadedConfig.personal,
            // Use saved name/email if present, otherwise fall back to Clerk data
            name: loadedConfig.personal?.name || initialName,
            email: loadedConfig.personal?.email || initialEmail,
            // Ensure membershipLevel has default if missing
            membershipLevel: loadedConfig.personal?.membershipLevel || 'free',
          },
          // Ensure smartBriefing exists with defaults if missing
          smartBriefing: loadedConfig.smartBriefing || DEFAULT_CONFIG.smartBriefing,
        };

        setConfig(mergedConfig);
      } catch (e) {
        console.error('Failed to load config:', e);
      }
    }
  }, [initialName, initialEmail]);

  // Save config to localStorage
  const saveConfig = () => {
    localStorage.setItem('omnidoxa-briefing-config', JSON.stringify(config));
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 3000);
  };

  // Reset to defaults
  const resetConfig = () => {
    if (confirm('Reset all settings to defaults?')) {
      const resetCfg = {
        ...DEFAULT_CONFIG,
        personal: {
          ...DEFAULT_CONFIG.personal,
          name: initialName,
          email: initialEmail,
        },
      };
      setConfig(resetCfg);
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

  // Generate preview from API
  const generatePreviewFromAPI = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    setShowPreview(true); // Open modal immediately to show loading state

    try {
      const response = await fetch('/api/briefing/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Preview generation failed');
      }

      const data = await response.json();
      setPreviewHtml(data.html);
    } catch (error) {
      console.error('Preview error:', error);
      setPreviewError('Failed to generate preview. Please try again.');
      setPreviewHtml(''); // Clear any old preview
    } finally {
      setPreviewLoading(false);
    }
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
            onClick={generatePreviewFromAPI}
            disabled={previewLoading}
            className="flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card-bg)',
              color: 'var(--text)',
            }}
          >
            {previewLoading ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Preview Briefing
              </>
            )}
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
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Membership Level
                </label>
                <select
                  disabled
                  value={config.personal.membershipLevel}
                  className="w-full px-4 py-2 rounded-lg border bg-gray-100 cursor-not-allowed opacity-60"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--text)',
                  }}
                >
                  <option value="free">Free</option>
                  <option value="basic">Basic</option>
                  <option value="premium">Premium</option>
                </select>
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  Membership level determines which fields you can customize
                </p>
              </div>
            </div>
          </div>

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

          {/* Smart Briefing */}
          <div
            className="rounded-lg border p-6 transition-all duration-300"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card-bg)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
                  🧠 Smart Briefing
                </h3>
                <span className="text-xs px-3 py-1 rounded-full bg-amber-500 text-white font-medium">
                  ⭐ Premium
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.smartBriefing.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      smartBriefing: { ...config.smartBriefing, enabled: e.target.checked },
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {config.smartBriefing.enabled && (
              <div className="animate-slide-down">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Topic for AI analysis
                </label>
                <input
                  type="text"
                  value={config.smartBriefing.topic}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      smartBriefing: { ...config.smartBriefing, topic: e.target.value },
                    })
                  }
                  placeholder="e.g., Artificial Intelligence, Cryptocurrency, Climate Change"
                  maxLength={100}
                  className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                  }}
                />
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  {config.smartBriefing.topic.length}/100 characters
                </p>
                <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>
                  Your briefing will include AI-generated analysis with executive summary, key developments, and future implications.
                </p>
              </div>
            )}
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
          onClick={() => {
            setShowPreview(false);
            setPreviewError(null);
          }}
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
                onClick={() => {
                  setShowPreview(false);
                  setPreviewError(null);
                }}
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
              {previewLoading && (
                <div className="flex flex-col items-center justify-center h-full p-12">
                  <svg
                    className="animate-spin mb-4"
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  <p className="text-lg font-medium" style={{ color: 'var(--text)' }}>
                    Generating your briefing preview...
                  </p>
                  <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                    This may take a few seconds
                  </p>
                </div>
              )}
              {previewError && (
                <div className="flex flex-col items-center justify-center h-full p-12">
                  <svg
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    className="mb-4"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p className="text-lg font-medium mb-2" style={{ color: 'var(--text)' }}>
                    {previewError}
                  </p>
                  <button
                    onClick={generatePreviewFromAPI}
                    className="mt-4 px-6 py-2 rounded-lg border transition-all hover:scale-105"
                    style={{
                      borderColor: '#2563eb',
                      background: '#2563eb',
                      color: 'white',
                    }}
                  >
                    Try Again
                  </button>
                </div>
              )}
              {!previewLoading && !previewError && previewHtml && (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-full min-h-[600px]"
                  title="Briefing Preview"
                />
              )}
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
        @keyframes slide-down {
          from {
            opacity: 0;
            max-height: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            max-height: 500px;
            transform: translateY(0);
          }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
