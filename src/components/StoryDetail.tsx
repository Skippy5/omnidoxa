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
  right: { label: 'Right-Leaning', emoji: '🔴', color: '#ef4444' },
  center: { label: 'Center / Moderate', emoji: '🟡', color: '#eab308' },
  left: { label: 'Left-Leaning', emoji: '🔵', color: '#3b82f6' },
} as const;

const LEAN_CSS_VARS = {
  right: { bg: 'var(--vp-right-bg)', border: 'var(--vp-right-border)' },
  center: { bg: 'var(--vp-center-bg)', border: 'var(--vp-center-border)' },
  left: { bg: 'var(--vp-left-bg)', border: 'var(--vp-left-border)' },
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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8 backdrop-blur-sm"
      style={{ background: 'var(--overlay-bg)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-5xl rounded-2xl border shadow-2xl mb-8" style={{ borderColor: 'var(--border)', background: 'var(--modal-bg)' }}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)' }}
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
            <span className="text-sm" style={{ color: 'var(--text-faint)' }}>{story.source}</span>
            <span className="text-sm" style={{ color: 'var(--text-faint)' }}>
              {new Date(story.published_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>

          <h2 className="mb-3 text-2xl font-bold leading-tight" style={{ color: 'var(--text)' }}>
            {story.title}
          </h2>

          {/* Hero image in detail view */}
          {story.image_url && (
            <div className="mb-4 overflow-hidden rounded-xl">
              <img
                src={story.image_url}
                alt=""
                className="w-full max-h-80 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                }}
              />
            </div>
          )}

          {story.description && (
            <p className="mb-4 text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {story.description}
            </p>
          )}

          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
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
        <div className="border-t p-6" style={{ borderColor: 'var(--border)' }}>
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
              📊 Sentiment Analysis
            </h3>
            {availabilityNote && (
              <span className="text-xs italic max-w-sm text-right" style={{ color: 'var(--text-dim)' }}>
                {availabilityNote}
              </span>
            )}
          </div>

          <div className="space-y-4">
            {(['right', 'center', 'left'] as const).map((lean) => {
              const config = LEAN_CONFIG[lean];
              const cssVars = LEAN_CSS_VARS[lean];
              const viewpoint: ViewpointWithPosts | undefined = story.viewpoints.find(v => v.lean === lean);

              return (
                <div
                  key={lean}
                  className="overflow-hidden rounded-xl border"
                  style={{ borderColor: cssVars.border }}
                >
                  {/* Viewpoint header */}
                  <div
                    className="px-4 py-2.5 flex items-center gap-2"
                    style={{ backgroundColor: cssVars.bg }}
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
                        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                          {viewpoint.summary}
                        </p>

                        {/* Supporting tweets */}
                        {viewpoint.social_posts && viewpoint.social_posts.length > 0 && (
                          <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>
                              Supporting Posts on 𝕏
                            </p>
                            <div className="space-y-2">
                              {viewpoint.social_posts.map((post) => (
                                <a
                                  key={post.id}
                                  href={post.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block rounded-lg p-3 transition-colors group"
                                  style={{ background: 'var(--card-bg-alt)' }}
                                >
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                      {post.author}
                                    </span>
                                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                                      {post.author_handle}
                                    </span>
                                    {(post as any).is_verified && (
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#1d9bf0" className="flex-shrink-0">
                                        <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.66 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.07 4.83-3.54-3.54 1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41-5.64 5.66z" />
                                      </svg>
                                    )}
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: 'var(--text-dim)' }}>
                                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" fill="none" strokeWidth="2" />
                                    </svg>
                                  </div>
                                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
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
                        <p className="text-sm font-medium" style={{ color: 'var(--text-dim)' }}>
                          Analysis unavailable
                        </p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-ghost)' }}>
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
