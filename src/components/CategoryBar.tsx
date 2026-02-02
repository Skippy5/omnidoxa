'use client';

import type { Category } from '@/lib/types';

const CATEGORIES: { key: Category | 'all'; label: string; color: string }[] = [
  { key: 'all', label: 'All', color: '#888' },
  { key: 'politics', label: 'Politics', color: '#a855f7' },
  { key: 'crime', label: 'Crime', color: '#ef4444' },
  { key: 'us', label: 'US', color: '#3b82f6' },
  { key: 'international', label: 'International', color: '#22c55e' },
  { key: 'science_tech', label: 'Sci/Tech', color: '#06b6d4' },
];

interface CategoryBarProps {
  selected: Category | 'all';
  onSelect: (category: Category | 'all') => void;
}

export default function CategoryBar({ selected, onSelect }: CategoryBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map(({ key, label, color }) => {
        const isActive = selected === key;
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className="rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200"
            style={{
              backgroundColor: isActive ? color : 'transparent',
              color: isActive ? '#fff' : color,
              border: `1px solid ${isActive ? color : color + '44'}`,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
