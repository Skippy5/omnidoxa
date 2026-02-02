'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Category, StoryWithViewpoints } from '@/lib/types';
import CategoryBar from '@/components/CategoryBar';
import StoryCard from '@/components/StoryCard';
import StoryDetail from '@/components/StoryDetail';

export default function Home() {
  const [stories, setStories] = useState<StoryWithViewpoints[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [selectedStory, setSelectedStory] = useState<StoryWithViewpoints | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStories = useCallback(async (category?: Category) => {
    try {
      const params = category ? `?category=${category}` : '';
      const res = await fetch(`/api/stories${params}`);
      if (!res.ok) throw new Error('Failed to fetch stories');
      const data = await res.json();
      return data.stories as StoryWithViewpoints[];
    } catch (err) {
      throw err;
    }
  }, []);

  const loadStories = useCallback(async () => {
    setError(null);
    try {
      const category = selectedCategory === 'all' ? undefined : selectedCategory;
      const data = await fetchStories(category);

      if (data.length === 0) {
        // No stories in DB, trigger a refresh
        setRefreshing(true);
        const res = await fetch('/api/stories/refresh', { method: 'POST' });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? 'Failed to refresh stories');
        }
        const refreshData = await res.json();
        setStories(category
          ? refreshData.stories.filter((s: StoryWithViewpoints) => s.category === category)
          : refreshData.stories
        );
        setRefreshing(false);
      } else {
        setStories(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, fetchStories]);

  useEffect(() => {
    setLoading(true);
    loadStories();
  }, [loadStories]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/stories/refresh', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to refresh stories');
      }
      const data = await res.json();
      const category = selectedCategory === 'all' ? undefined : selectedCategory;
      setStories(category
        ? data.stories.filter((s: StoryWithViewpoints) => s.category === category)
        : data.stories
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#2a2a2a] bg-[#0f0f0f]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Omni<span className="text-purple-400">Doxa</span>
            </h1>
            <p className="text-xs tracking-widest text-[#666] uppercase">
              All Viewpoints
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-[#aaa] transition-all hover:border-[#444] hover:text-white disabled:opacity-50"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={refreshing ? 'animate-spin' : ''}
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Category filter */}
        <div className="mx-auto max-w-7xl px-4 pb-3 sm:px-6">
          <CategoryBar selected={selectedCategory} onSelect={setSelectedCategory} />
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Error state */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
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

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-purple-400" />
            <p className="text-sm text-[#666]">Loading stories...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && stories.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5" className="mb-4">
              <rect x="2" y="3" width="20" height="18" rx="2" />
              <line x1="2" y1="8" x2="22" y2="8" />
              <line x1="8" y1="3" x2="8" y2="21" />
            </svg>
            <p className="text-lg font-medium text-[#555]">No stories yet</p>
            <p className="mt-1 text-sm text-[#444]">
              Click Refresh to fetch the latest news
            </p>
          </div>
        )}

        {/* Story grid */}
        {!loading && stories.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                onClick={() => setSelectedStory(story)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Story detail modal */}
      {selectedStory && (
        <StoryDetail
          story={selectedStory}
          onClose={() => setSelectedStory(null)}
        />
      )}
    </div>
  );
}
