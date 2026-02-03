'use client';

import { useEffect } from 'react';
import type { StoryWithViewpoints, ViewpointWithPosts } from '@/lib/types';

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
  right: { label: 'Right-Leaning', emoji: '🔴', color: '#ef4444', bg: '#5f1e1e', border: '#7f2d2d' },
  center: { label: 'Center / Moderate', emoji: '🟡', color: '#eab308', bg: '#2a2a1a', border: '#3d3d1a' },
  left: { label: 'Left-Leaning', emoji: '🔵', color: '#3b82f6', bg: '#1e3a5f', border: '#1e4d8f' },
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

  // Get availability note from first viewpoint (same for all)
  const availabilityNote = (story.viewpoints?.[0] as any)?.availability_note;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 pt-8 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-5xl rounded-2xl border border-[#2a2a2a] bg-[#141414] shadow-2xl mb-8">
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

        {/* Sentiment Analysis Section */}
        <div className="border-t border-[#2a2a2a] p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              📊 Sentiment Analysis
            </h3>
            {availabilityNote && (
              <span className="text-xs text-[#555] italic max-w-sm text-right">
                {availabilityNote}
              </span>
            )}
          </div>

          <div className="space-y-4">
            {(['right', 'center', 'left'] as const).map((lean) => {
              const config = LEAN_CONFIG[lean];
              const viewpoint: ViewpointWithPosts | undefined = story.viewpoints.find(v => v.lean === lean);

              return (
                <div
                  key={lean}
                  className="overflow-hidden rounded-xl border"
                  style={{ borderColor: config.border }}
                >
                  {/* Viewpoint header */}
                  <div
                    className="px-4 py-2.5 flex items-center gap-2"
                    style={{ backgroundColor: config.bg }}
                  >
                    <span className="text-base">{config.emoji}</span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: config.color }}
                    >
                      {config.label}
                    </span>
                  </div>

                  <div className="p-4">
                    {viewpoint ? (
                      <>
                        {/* Summary */}
                        <p className="text-sm leading-relaxed text-[#ccc] mb-3">
                          {viewpoint.summary}
                        </p>

                        {/* Supporting tweets */}
                        {viewpoint.social_posts && viewpoint.social_posts.length > 0 && (
                          <div className="border-t border-[#2a2a2a] pt-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-[#555] mb-2">
                              Supporting Posts on 𝕏
                            </p>
                            <div className="space-y-2">
                              {viewpoint.social_posts.map((post) => (
                                <a
                                  key={post.id}
                                  href={post.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block rounded-lg bg-[#1a1a1a] p-3 transition-colors hover:bg-[#222] group"
                                >
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-xs font-medium text-[#aaa]">
                                      {post.author}
                                    </span>
                                    <span className="text-xs text-[#555]">
                                      {post.author_handle}
                                    </span>
                                    {(post as any).is_verified && (
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#1d9bf0" className="flex-shrink-0">
                                        <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.66 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.07 4.83-3.54-3.54 1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.64 5.66z" />
                                      </svg>
                                    )}
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#555" className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke="#555" fill="none" strokeWidth="2" />
                                    </svg>
                                  </div>
                                  <p className="text-xs leading-relaxed text-[#888]">
                                    &ldquo;{post.text}&rdquo;
                                  </p>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <p className="text-sm font-medium text-[#555]">
                          Analysis unavailable
                        </p>
                        <p className="mt-1 text-xs text-[#444]">
                          Sentiment data for this perspective was not generated
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
