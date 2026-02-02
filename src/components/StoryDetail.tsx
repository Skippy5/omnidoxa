'use client';

import { useEffect } from 'react';
import type { StoryWithViewpoints } from '@/lib/types';

const CATEGORY_COLORS: Record<string, string> = {
  politics: '#a855f7',
  crime: '#ef4444',
  us: '#3b82f6',
  international: '#22c55e',
  science_tech: '#06b6d4',
};

const CATEGORY_LABELS: Record<string, string> = {
  politics: 'Politics',
  crime: 'Crime',
  us: 'US',
  international: 'International',
  science_tech: 'Sci/Tech',
};

const LEAN_CONFIG = {
  left: { label: 'Left', color: '#3b82f6', bg: '#1e3a5f' },
  center: { label: 'Center', color: '#9ca3af', bg: '#2a2a2a' },
  right: { label: 'Right', color: '#ef4444', bg: '#5f1e1e' },
} as const;

interface StoryDetailProps {
  story: StoryWithViewpoints;
  onClose: () => void;
}

export default function StoryDetail({ story, onClose }: StoryDetailProps) {
  const color = CATEGORY_COLORS[story.category] ?? '#888';
  const label = CATEGORY_LABELS[story.category] ?? story.category;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 pt-12 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-4xl rounded-2xl border border-[#2a2a2a] bg-[#141414] shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#2a2a2a] text-[#888] transition-colors hover:bg-[#333] hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <div className="p-6 pb-4">
          <div className="mb-3 flex items-center gap-3">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              {label}
            </span>
            <span className="text-sm text-[#666]">{story.source}</span>
            <span className="text-sm text-[#666]">
              {new Date(story.published_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>

          <h2 className="mb-3 text-2xl font-bold leading-tight text-white">
            {story.title}
          </h2>

          {story.description && (
            <p className="mb-4 text-base leading-relaxed text-[#aaa]">
              {story.description}
            </p>
          )}

          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[#2a2a2a] px-4 py-2 text-sm font-medium text-[#aaa] transition-colors hover:border-[#444] hover:text-white"
          >
            Read original article
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>

        {/* Viewpoint panels */}
        <div className="border-t border-[#2a2a2a] p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Viewpoints</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {(['left', 'center', 'right'] as const).map((lean) => {
              const config = LEAN_CONFIG[lean];
              const viewpoint = story.viewpoints.find(v => v.lean === lean);

              return (
                <div
                  key={lean}
                  className="overflow-hidden rounded-xl border border-[#2a2a2a]"
                >
                  <div
                    className="px-4 py-2.5 text-sm font-semibold"
                    style={{ backgroundColor: config.bg, color: config.color }}
                  >
                    {config.label}
                  </div>
                  <div className="p-4">
                    {viewpoint ? (
                      <p className="text-sm leading-relaxed text-[#ccc]">
                        {viewpoint.summary}
                      </p>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <div className="mb-2 text-2xl text-[#333]">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-[#555]">
                          Coming in Phase 2
                        </p>
                        <p className="mt-1 text-xs text-[#444]">
                          AI-powered viewpoint analysis
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
