'use client';

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
    <button
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] text-left transition-all duration-200 hover:border-[#3a3a3a] hover:bg-[#222] hover:shadow-lg hover:shadow-black/20"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-[#111]">
        {story.image_url ? (
          <img
            src={story.image_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-[#333]">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="18" rx="2" />
              <line x1="2" y1="8" x2="22" y2="8" />
              <line x1="8" y1="3" x2="8" y2="21" />
            </svg>
          </div>
        )}
        {/* Category badge */}
        <span
          className="absolute top-2 left-2 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          {label}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-white">
          {story.title}
        </h3>

        {story.description && (
          <p className="line-clamp-2 text-sm leading-relaxed text-[#888]">
            {story.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-xs text-[#666]">
            <span className="font-medium text-[#999]">{story.source}</span>
            <span>·</span>
            <span>{timeAgo(story.published_at)}</span>
          </div>

          {/* Viewpoint indicator dots */}
          <div className="flex gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: story.viewpoints.some(v => v.lean === 'left') ? '#3b82f6' : '#333' }}
              title="Left viewpoint"
            />
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: story.viewpoints.some(v => v.lean === 'center') ? '#888' : '#333' }}
              title="Center viewpoint"
            />
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: story.viewpoints.some(v => v.lean === 'right') ? '#ef4444' : '#333' }}
              title="Right viewpoint"
            />
          </div>
        </div>
      </div>
    </button>
  );
}
