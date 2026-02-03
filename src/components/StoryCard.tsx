'use client';

import type { StoryWithViewpoints } from '@/lib/types';
import SentimentBar from './SentimentBar';

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

const CATEGORY_GRADIENTS: Record<string, string> = {
  politics: 'from-purple-900/60 via-purple-800/30 to-transparent',
  crime: 'from-red-900/60 via-red-800/30 to-transparent',
  us: 'from-blue-900/60 via-blue-800/30 to-transparent',
  international: 'from-green-900/60 via-green-800/30 to-transparent',
  science_tech: 'from-cyan-900/60 via-cyan-800/30 to-transparent',
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
  const gradient = CATEGORY_GRADIENTS[story.category] ?? 'from-gray-900/60 to-transparent';

  return (
    <article
      onClick={onClick}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-[#222] bg-[#161616] transition-all duration-300 hover:border-[#333] hover:bg-[#1a1a1a] hover:shadow-2xl hover:shadow-black/40"
    >
      {/* Hero image area — only rendered if image exists */}
      {story.image_url && (
        <div className="relative h-48 sm:h-56 overflow-hidden">
          <img
            src={story.image_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              // Hide the image container if image fails to load
              (e.target as HTMLImageElement).parentElement!.style.display = 'none';
            }}
          />

          {/* Overlay gradient for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#161616] via-transparent to-transparent" />

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
            <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-[#bbb] backdrop-blur-sm">
              {timeAgo(story.published_at)}
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-5 pt-4">
        <div className="flex items-center gap-2 text-xs text-[#666] mb-2 flex-wrap">
          {/* Show category badge inline when no image */}
          {!story.image_url && (
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white mr-1"
              style={{ backgroundColor: color }}
            >
              {label}
            </span>
          )}
          <span className="font-semibold text-[#999]">{story.source}</span>
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

        <h2 className="text-lg sm:text-xl font-bold leading-tight text-white mb-2 group-hover:text-purple-300 transition-colors">
          {story.title}
        </h2>

        {story.description && (
          <p className="text-sm leading-relaxed text-[#888] mb-4 line-clamp-2">
            {story.description}
          </p>
        )}

        {/* Sentiment Bar */}
        {story.viewpoints && story.viewpoints.length > 0 && (
          <div className="border-t border-[#222] pt-3 mt-2">
            <SentimentBar viewpoints={story.viewpoints} />
          </div>
        )}

        {/* Click hint */}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-[#444] group-hover:text-[#666] transition-colors">
          <span>Tap for full analysis</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </article>
  );
}
