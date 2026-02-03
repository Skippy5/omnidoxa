'use client';

import type { ViewpointWithPosts } from '@/lib/types';

interface SentimentBarProps {
  viewpoints: ViewpointWithPosts[];
  compact?: boolean;
}

const LEAN_MARKERS = {
  left: { label: 'L', color: '#3b82f6', ring: '#1d4ed8' },
  center: { label: 'C', color: '#a3a3a3', ring: '#737373' },
  right: { label: 'R', color: '#ef4444', ring: '#b91c1c' },
} as const;

/**
 * Convert sentiment_score (-1 to +1) to a percentage position (0-100%) on the bar.
 * -1 = 0% (far left / very negative)
 *  0 = 50% (center / neutral)
 * +1 = 100% (far right / very positive)
 */
function scoreToPercent(score: number): number {
  return Math.max(2, Math.min(98, ((score + 1) / 2) * 100));
}

function sentimentLabel(score: number): string {
  if (score <= -0.6) return 'Very Negative';
  if (score <= -0.2) return 'Negative';
  if (score <= 0.2) return 'Neutral';
  if (score <= 0.6) return 'Positive';
  return 'Very Positive';
}

export default function SentimentBar({ viewpoints, compact = false }: SentimentBarProps) {
  if (!viewpoints || viewpoints.length === 0) return null;

  const barHeight = compact ? 'h-2' : 'h-3';
  const markerSize = compact ? 'w-5 h-5 text-[9px]' : 'w-7 h-7 text-[11px]';

  return (
    <div className={compact ? 'py-1' : 'py-2'}>
      {/* Labels */}
      {!compact && (
        <div className="flex justify-between text-[10px] mb-1 px-1" style={{ color: 'var(--text-dim)' }}>
          <span>Negative</span>
          <span>Neutral</span>
          <span>Positive</span>
        </div>
      )}

      {/* Bar */}
      <div className="relative">
        <div
          className={`${barHeight} w-full rounded-full overflow-hidden`}
          style={{
            background: 'linear-gradient(to right, #dc2626, #f59e0b, #16a34a)',
            opacity: 0.35,
          }}
        />

        {/* Markers */}
        {(['left', 'center', 'right'] as const).map((lean) => {
          const vp = viewpoints.find((v) => v.lean === lean);
          if (!vp) return null;

          const score = vp.sentiment_score ?? 0;
          const pct = scoreToPercent(score);
          const marker = LEAN_MARKERS[lean];

          return (
            <div
              key={lean}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
              style={{ left: `${pct}%` }}
            >
              <div
                className={`${markerSize} rounded-full flex items-center justify-center font-bold border-2 shadow-lg cursor-default transition-transform hover:scale-110`}
                style={{
                  backgroundColor: marker.color,
                  borderColor: marker.ring,
                  color: '#fff',
                }}
                title={`${lean.charAt(0).toUpperCase() + lean.slice(1)}: ${sentimentLabel(score)} (${score > 0 ? '+' : ''}${score.toFixed(1)})`}
              >
                {marker.label}
              </div>

              {/* Tooltip */}
              {!compact && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="rounded-lg px-3 py-1.5 text-xs whitespace-nowrap shadow-xl" style={{ background: 'var(--hover-bg)', border: '1px solid var(--border-hover)', color: 'var(--text)' }}>
                    <span style={{ color: marker.color }} className="font-semibold">
                      {lean.charAt(0).toUpperCase() + lean.slice(1)}
                    </span>
                    {' · '}
                    {sentimentLabel(score)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
