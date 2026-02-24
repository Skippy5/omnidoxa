'use client';

import { useState } from 'react';
import type { Category } from '@/lib/types';

const CATEGORIES: { key: Category | 'all'; label: string; color: string; emoji: string }[] = [
  { key: 'all', label: 'All', color: '#888', emoji: '📰' },
  { key: 'top', label: 'Top Stories', color: '#eab308', emoji: '⭐' },
  { key: 'breaking', label: 'Breaking', color: '#ef4444', emoji: '🔥' },
  { key: 'technology', label: 'Technology', color: '#8b5cf6', emoji: '💻' },
  { key: 'domestic', label: 'Domestic', color: '#3b82f6', emoji: '🏠' },
  { key: 'business', label: 'Business', color: '#f59e0b', emoji: '💼' },
  { key: 'crime', label: 'Crime', color: '#dc2626', emoji: '🚨' },
  { key: 'entertainment', label: 'Entertainment', color: '#f43f5e', emoji: '🎬' },
  { key: 'politics', label: 'Politics', color: '#a855f7', emoji: '🏛️' },
  { key: 'science', label: 'Science', color: '#06b6d4', emoji: '🔬' },
  { key: 'world', label: 'World', color: '#22c55e', emoji: '🌍' },
];

interface CategoryBarProps {
  selected: Category | 'all';
  onSelect: (category: Category | 'all') => void;
}

export default function CategoryBar({ selected, onSelect }: CategoryBarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const selectedCategory = CATEGORIES.find(cat => cat.key === selected) || CATEGORIES[0];

  const handleCategorySelect = (key: Category | 'all') => {
    onSelect(key);
    setIsDropdownOpen(false); // Close dropdown on mobile after selection
  };

  const handleKeyDown = (e: React.KeyboardEvent, key: Category | 'all') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCategorySelect(key);
    }
  };

  return (
    <>
      {/* MOBILE: Dropdown Select (< 768px) */}
      <div className="relative md:hidden">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsDropdownOpen(!isDropdownOpen);
            }
          }}
          aria-label="Select category"
          aria-expanded={isDropdownOpen}
          aria-haspopup="listbox"
          className="flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
          style={{
            borderColor: selectedCategory.color + '66',
            backgroundColor: 'var(--card-bg)',
            color: selectedCategory.color,
          }}
        >
          <span className="flex items-center gap-2">
            <span>{selectedCategory.emoji}</span>
            <span>{selectedCategory.label}</span>
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <>
            {/* Backdrop - close on click outside */}
            <div
              className="fixed inset-0 z-30"
              onClick={() => setIsDropdownOpen(false)}
              aria-hidden="true"
            />
            
            <div
              role="listbox"
              aria-label="Category options"
              className="absolute left-0 right-0 z-40 mt-2 max-h-96 overflow-y-auto rounded-lg border shadow-lg"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--card-bg)',
              }}
            >
              {CATEGORIES.map(({ key, label, color, emoji }) => {
                const isActive = selected === key;
                return (
                  <button
                    key={key}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleCategorySelect(key)}
                    onKeyDown={(e) => handleKeyDown(e, key)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-all duration-150 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-purple-400"
                    style={{
                      backgroundColor: isActive ? color + '22' : 'transparent',
                      color: isActive ? color : 'var(--text-secondary)',
                    }}
                  >
                    <span className="text-lg">{emoji}</span>
                    <span className="flex-1">{label}</span>
                    {isActive && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={color}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* DESKTOP: Horizontal Pills (≥ 768px) */}
      <div className="hidden flex-wrap gap-2 md:flex" role="tablist" aria-label="Category filter">
        {CATEGORIES.map(({ key, label, color, emoji }) => {
          const isActive = selected === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={isActive}
              aria-label={`Filter by ${label}`}
              onClick={() => handleCategorySelect(key)}
              onKeyDown={(e) => handleKeyDown(e, key)}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-400"
              style={{
                backgroundColor: isActive ? color : 'transparent',
                color: isActive ? '#fff' : color,
                border: `1px solid ${isActive ? color : color + '44'}`,
              }}
            >
              <span className="mr-1.5">{emoji}</span>
              {label}
            </button>
          );
        })}
      </div>
    </>
  );
}
