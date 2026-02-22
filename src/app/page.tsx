'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import type { Category, StoryWithViewpoints } from '@/lib/types';
import CategoryBar from '@/components/CategoryBar';
import StoryCard from '@/components/StoryCard';
import StoryDetail from '@/components/StoryDetail';
import AdBanner, { InFeedAd } from '@/components/AdBanner';
import ThemeToggle from '@/components/ThemeToggle';
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';

// Detect if we're running on a static host (GitHub Pages) or with API routes
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function Home() {
  const [stories, setStories] = useState<StoryWithViewpoints[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [selectedStory, setSelectedStory] = useState<StoryWithViewpoints | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const loadStories = useCallback(async () => {
    setError(null);
    try {
      // Try static JSON first (works on GitHub Pages), fall back to API route
      let data;
      try {
        const res = await fetch(`${BASE_PATH}/stories.json`);
        if (res.ok) {
          data = await res.json();
          setFetchedAt(data.fetched_at || null);
          const allStories = (data.stories || []) as StoryWithViewpoints[];
          setStories(allStories);
          return;
        }
      } catch {
        // Static file not available, try API
      }

      // Fall back to API routes (dev mode)
      const res = await fetch(`/api/stories`);
      if (!res.ok) throw new Error('Failed to fetch stories');
      data = await res.json();
      const allStories = (data.stories || []) as StoryWithViewpoints[];

      setStories(allStories);
      setFetchedAt(data.fetched_at || new Date().toISOString());
      
      // If analyzing, show message
      if (data.analyzing && data.message) {
        setError(data.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadStories();
  }, [loadStories]);

  // Filter stories by category client-side
  const filteredStories = useMemo(() => {
    if (selectedCategory === 'all') return stories;
    return stories.filter(s => s.category === selectedCategory);
  }, [stories, selectedCategory]);

  const formatUpdatedAt = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `Updated ${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 12) return `Updated ${hours}h ago`;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b backdrop-blur-md" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 95%, transparent)' }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
              Omni<span className="text-purple-400">Doxa</span>
            </h1>
            <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--text-faint)' }}>
              All Viewpoints
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            {fetchedAt && (
              <span className="hidden text-xs sm:block" style={{ color: 'var(--text-dim)' }}>
                {formatUpdatedAt(fetchedAt)}
              </span>
            )}
            <ThemeToggle />
            <Link
              href="/games"
              aria-label="Games"
              className="flex items-center gap-1 sm:gap-2 rounded-lg border px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium transition-all hover:scale-105"
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
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5 sm:h-4 sm:w-4"
              >
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M6 12h4M8 10v4" />
                <circle cx="17" cy="10" r="1" />
                <circle cx="15" cy="14" r="1" />
              </svg>
              <span className="hidden sm:inline">Games</span>
            </Link>
            <Link
              href="/briefing"
              aria-label="Daily Briefing"
              className="flex items-center gap-1 sm:gap-2 rounded-lg border px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium transition-all hover:scale-105"
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
                className="h-3.5 w-3.5 sm:h-4 sm:w-4"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span className="hidden sm:inline">Daily Briefing</span>
            </Link>
            
            {/* Clerk Auth - Show at far right */}
            <SignedOut>
              <SignInButton mode="modal">
                <button className="rounded-lg border px-4 py-2 text-sm font-medium transition-all hover:scale-105"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-secondary)',
                  }}>
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>

        {/* Category filter */}
        <div className="mx-auto max-w-7xl px-4 pb-3 sm:px-6">
          <CategoryBar selected={selectedCategory} onSelect={setSelectedCategory} />
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {error && (
          <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-t-purple-400" style={{ borderColor: 'var(--border)', borderTopColor: '#a855f7' }} />
            <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Loading stories...</p>
          </div>
        )}

        {!loading && filteredStories.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-ghost)" strokeWidth="1.5" className="mb-4">
              <rect x="2" y="3" width="20" height="18" rx="2" />
              <line x1="2" y1="8" x2="22" y2="8" />
              <line x1="8" y1="3" x2="8" y2="21" />
            </svg>
            <p className="text-lg font-medium" style={{ color: 'var(--text-dim)' }}>No stories yet</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-ghost)' }}>
              Click Refresh to fetch the latest news
            </p>
          </div>
        )}

        {!loading && filteredStories.length > 0 && (
          <div className="mx-auto max-w-2xl space-y-6">
            {/* Top banner ad */}
            <AdBanner slot="SLOT_BANNER_PLACEHOLDER" className="mb-2" />
            
            {filteredStories.map((story, index) => (
              <div key={story.id}>
                <StoryCard
                  story={story}
                  onClick={() => setSelectedStory(story)}
                />
                {/* In-feed ad every 5 articles */}
                {(index + 1) % 5 === 0 && index < filteredStories.length - 1 && (
                  <div className="mt-6">
                    <InFeedAd />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedStory && (
        <StoryDetail
          story={selectedStory}
          onClose={() => setSelectedStory(null)}
        />
      )}
    </div>
  );
}
