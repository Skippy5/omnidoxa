'use client';

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
  const handleKeyDown = (e: React.KeyboardEvent, key: Category | 'all') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(key);
    }
  };

  // Helper: Convert hex to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <div className="flex flex-wrap gap-2.5" role="tablist" aria-label="Category filter">
      {CATEGORIES.map(({ key, label, color, emoji }) => {
        const isActive = selected === key;
        
        return (
          <button
            key={key}
            role="tab"
            aria-selected={isActive}
            aria-label={`Filter by ${label}`}
            onClick={() => onSelect(key)}
            onKeyDown={(e) => handleKeyDown(e, key)}
            className="gem-pill relative overflow-hidden rounded-full px-4 py-2 text-sm font-bold transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{
              // Base gradient background
              background: isActive 
                ? `linear-gradient(135deg, ${color} 0%, ${hexToRgba(color, 0.7)} 100%)`
                : `linear-gradient(135deg, ${hexToRgba(color, 0.25)} 0%, ${hexToRgba(color, 0.1)} 100%)`,
              
              // Border with gem-like shimmer
              border: `1.5px solid ${isActive ? hexToRgba(color, 0.8) : hexToRgba(color, 0.4)}`,
              
              // Multi-layer shadow for depth + glow
              boxShadow: isActive
                ? `
                    0 0 20px ${hexToRgba(color, 0.5)},
                    0 0 40px ${hexToRgba(color, 0.3)},
                    0 4px 12px rgba(0, 0, 0, 0.3),
                    inset 0 1px 0 ${hexToRgba(color, 0.6)},
                    inset 0 -1px 2px rgba(0, 0, 0, 0.3)
                  `
                : `
                    0 0 10px ${hexToRgba(color, 0.2)},
                    0 2px 8px rgba(0, 0, 0, 0.15),
                    inset 0 1px 0 ${hexToRgba(color, 0.3)},
                    inset 0 -1px 1px rgba(0, 0, 0, 0.2)
                  `,
              
              // Text color
              color: isActive ? '#fff' : color,
              
              // Focus ring color
              ['--tw-ring-color' as string]: color,
            }}
          >
            {/* Diagonal shine overlay (gem facet effect) */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-30"
              style={{
                background: `linear-gradient(135deg, transparent 0%, ${hexToRgba(color, 0.4)} 45%, ${hexToRgba(color, 0.6)} 50%, ${hexToRgba(color, 0.4)} 55%, transparent 100%)`,
                animation: isActive ? 'shimmer 3s ease-in-out infinite' : 'none',
              }}
            />
            
            {/* Radial highlight (light reflection) */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-25"
              style={{
                background: `radial-gradient(ellipse at 25% 25%, ${hexToRgba(color, 0.8)} 0%, transparent 60%)`,
              }}
            />
            
            {/* Content */}
            <span className="relative flex items-center gap-1.5 drop-shadow-sm">
              <span className="text-base">{emoji}</span>
              <span>{label}</span>
            </span>
          </button>
        );
      })}

      <style jsx>{`
        @keyframes shimmer {
          0%, 100% {
            transform: translateX(-100%);
            opacity: 0.3;
          }
          50% {
            transform: translateX(100%);
            opacity: 0.6;
          }
        }

        .gem-pill:hover {
          filter: brightness(1.15);
        }

        .gem-pill:active {
          transform: scale(0.98);
        }

        /* Pulse glow on active gems */
        .gem-pill[aria-selected="true"] {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        @keyframes pulse-glow {
          0%, 100% {
            filter: brightness(1) drop-shadow(0 0 8px currentColor);
          }
          50% {
            filter: brightness(1.2) drop-shadow(0 0 16px currentColor);
          }
        }
      `}</style>
    </div>
  );
}
