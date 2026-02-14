'use client';

import type { Category } from '@/lib/types';

const CATEGORIES: { key: Category | 'all'; label: string; color: string; emoji: string }[] = [
  { key: 'all', label: 'All', color: '#888', emoji: '📰' },
  { key: 'breaking', label: 'Breaking', color: '#ef4444', emoji: '🔥' },
  { key: 'business', label: 'Business', color: '#f59e0b', emoji: '💼' },
  { key: 'crime', label: 'Crime', color: '#dc2626', emoji: '🚨' },
  { key: 'entertainment', label: 'Entertainment', color: '#f43f5e', emoji: '🎬' },
  { key: 'politics', label: 'Politics', color: '#a855f7', emoji: '🏛️' },
  { key: 'science', label: 'Science', color: '#06b6d4', emoji: '🔬' },
  { key: 'top', label: 'Top Stories', color: '#eab308', emoji: '⭐' },
  { key: 'world', label: 'World', color: '#22c55e', emoji: '🌍' },
];

interface CategoryBarProps {
  selected: Category | 'all';
  onSelect: (category: Category | 'all') => void;
}

export default function CategoryBar({ selected, onSelect }: CategoryBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map(({ key, label, color, emoji }) => {
        const isActive = selected === key;
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 hover:scale-105"
            style={{
              backgroundColor: isActive ? color : 'transparent',
              color: isActive ? '#fff' : color,
              border: `1px solid ${isActive ? color : color + '44'}`,
            }}
          >
            <span className="mr-1">{emoji}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
