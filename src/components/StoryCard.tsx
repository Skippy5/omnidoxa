'use client';

import type { StoryWithViewpoints } from '@/lib/types';
import SentimentBar from './SentimentBar';
import ShareButton from './ShareButton';

const CATEGORY_COLORS: Record<string, string> = {
  politics: '#a855f7',
  crime: '#ef4444',
  us: '#3b82f6',
  international: '#22c55e',
  science_tech: '#06b6d4',
  sports: '#f97316',
  health: '#ec4899',
  business: '#f59e0b',
  entertainment: '#f43f5e',
  environment: '#14b8a6',
};

const CATEGORY_LABELS: Record<string, string> = {
  politics: 'Politics',
  crime: 'Crime',
  us: 'US',
  international: 'International',
  science_tech: 'Sci/Tech',
  sports: 'Sports',
  health: 'Health',
  business: 'Business',
  entertainment: 'Entertainment',
  environment: 'Environment',
};

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface StoryCardProps {
  story: StoryWithViewpoints;
  onClick: () => void;
}

export default function StoryCard({ story, onClick }: StoryCardProps) {
  const color = CATEGORY_COLORS[story.category] ?? '#888';
  const label = CATEGORY_LABELS[story.category] ?? story.category;

  return (
    <article
      onClick={onClick}
      className="group cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-2xl"
      style={{
        borderColor: 'var(--border-light)',
        background: 'var(--card-bg)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--hover-bg)';
        e.currentTarget.style.background = 'var(--card-bg-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-light)';
        e.currentTarget.style.background = 'var(--card-bg)';
      }}
    >
      {/* Hero image area — only rendered if image exists */}
      {story.image_url && (
        <div className="relative h-48 sm:h-56 overflow-hidden">
          <img
            src={story.image_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).parentElement!.style.display = 'none';
            }}
          />

          {/* Overlay gradient for text readability */}
          <div className="absolute inset-0" style={{ background: `linear-gradient(to top, var(--card-bg), transparent)` }} />

          {/* Category + source badges on image */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-bold text-white backdrop-blur-sm"
              style={{ backgroundColor: color + 'cc' }}
            >
              {label}
            </span>
          </div>

          <div className="absolute top-4 right-4">
            <span className="rounded-full px-3 py-1 text-xs font-medium backdrop-blur-sm" style={{ background: 'var(--badge-bg)', color: 'var(--text-secondary)' }}>
              {timeAgo(story.published_at)}
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-5 pt-4">
        <div className="flex items-center gap-2 text-xs mb-2 flex-wrap" style={{ color: 'var(--text-faint)' }}>
          {/* Show category badge inline when no image */}
          {!story.image_url && (
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white mr-1"
              style={{ backgroundColor: color }}
            >
              {label}
            </span>
          )}
          <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>{story.source}</span>
          <span>·</span>
          <span>
            {new Date(story.published_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
          {!story.image_url && (
            <>
              <span>·</span>
              <span>{timeAgo(story.published_at)}</span>
            </>
          )}
        </div>

        <h2 className="text-lg sm:text-xl font-bold leading-tight mb-2 transition-colors group-hover:text-purple-400" style={{ color: 'var(--text)' }}>
          {story.title}
        </h2>

        {story.description && (
          <p className="text-sm leading-relaxed mb-4 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
            {story.description}
          </p>
        )}

        {/* Sentiment Bar */}
        {story.viewpoints && story.viewpoints.length > 0 && (
          <div className="border-t pt-3 mt-2" style={{ borderColor: 'var(--border-light)' }}>
            <SentimentBar viewpoints={story.viewpoints} />
          </div>
        )}

        {/* Click hint + share */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: 'var(--text-ghost)' }}>
            <span>Tap for full analysis</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
          <ShareButton story={story} />
        </div>
      </div>
    </article>
  );
}
