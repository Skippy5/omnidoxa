'use client';

import { useState, useRef, useEffect } from 'react';
import type { StoryWithViewpoints } from '@/lib/types';

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

const LEAN_COLORS = {
  left: { color: '#3b82f6', label: 'Left' },
  center: { color: '#a3a3a3', label: 'Center' },
  right: { color: '#ef4444', label: 'Right' },
} as const;

function generateShareImage(story: StoryWithViewpoints): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const W = 1200;
    const H = 630;
    canvas.width = W;
    canvas.height = H;

    // Background
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, W, H);

    // Category accent bar at top
    const catColor = CATEGORY_COLORS[story.category] ?? '#a855f7';
    ctx.fillStyle = catColor;
    ctx.fillRect(0, 0, W, 6);

    // Category badge
    ctx.fillStyle = catColor;
    roundRect(ctx, 48, 48, ctx.measureText(story.category.replace('_', '/').toUpperCase()).width + 32, 32, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(story.category.replace('_', '/').toUpperCase(), 64, 70);

    // Source
    ctx.fillStyle = '#888888';
    ctx.font = '16px system-ui, -apple-system, sans-serif';
    ctx.fillText(story.source, 48, 116);

    // Headline (word-wrapped)
    ctx.fillStyle = '#ededed';
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    const lines = wrapText(ctx, story.title, W - 96, 36);
    lines.slice(0, 4).forEach((line, i) => {
      ctx.fillText(line, 48, 170 + i * 48);
    });

    const vpY = 170 + Math.min(lines.length, 4) * 48 + 30;

    // Viewpoint mini preview
    if (story.viewpoints && story.viewpoints.length > 0) {
      ctx.fillStyle = '#333333';
      ctx.fillRect(48, vpY, W - 96, 1);

      ctx.fillStyle = '#666666';
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.fillText('SENTIMENT ANALYSIS', 48, vpY + 28);

      const barY = vpY + 48;
      // Gradient bar
      const gradient = ctx.createLinearGradient(48, 0, W - 48, 0);
      gradient.addColorStop(0, '#dc2626');
      gradient.addColorStop(0.5, '#f59e0b');
      gradient.addColorStop(1, '#16a34a');
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = gradient;
      roundRect(ctx, 48, barY, W - 96, 12, 6);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Markers
      (['left', 'center', 'right'] as const).forEach((lean) => {
        const vp = story.viewpoints.find(v => v.lean === lean);
        if (!vp) return;
        const score = vp.sentiment_score ?? 0;
        const pct = Math.max(2, Math.min(98, ((score + 1) / 2) * 100));
        const x = 48 + (pct / 100) * (W - 96);
        const cfg = LEAN_COLORS[lean];

        ctx.fillStyle = cfg.color;
        ctx.beginPath();
        ctx.arc(x, barY + 6, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(cfg.label[0], x, barY + 10);
        ctx.textAlign = 'left';
      });
    }

    // Branding footer
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, H - 70, W, 70);
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, H - 70, W, 1);

    ctx.fillStyle = '#ededed';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('Omni', 48, H - 30);
    const omniW = ctx.measureText('Omni').width;
    ctx.fillStyle = '#a855f7';
    ctx.fillText('Doxa', 48 + omniW, H - 30);

    ctx.fillStyle = '#666666';
    ctx.font = '16px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('See all sides at OmniDoxa.com', W - 48, H - 30);
    ctx.textAlign = 'left';

    resolve(canvas.toDataURL('image/png'));
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, _fontSize: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface ShareButtonProps {
  story: StoryWithViewpoints;
}

export default function ShareButton({ story }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const shareUrl = typeof window !== 'undefined' ? window.location.origin : 'https://omnidoxa.com';
  const shareText = `${story.title} — See all viewpoints on OmniDoxa`;

  const shareTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      '_blank',
      'width=550,height=420'
    );
    setOpen(false);
  };

  const shareLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(story.title)}`,
      '_blank',
      'width=550,height=420'
    );
    setOpen(false);
  };

  const shareFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`,
      '_blank',
      'width=550,height=420'
    );
    setOpen(false);
  };

  const downloadCard = async () => {
    setGenerating(true);
    const dataUrl = await generateShareImage(story);
    const link = document.createElement('a');
    link.download = `omnidoxa-${story.id}.png`;
    link.href = dataUrl;
    link.click();
    setGenerating(false);
    setOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="flex items-center justify-center w-8 h-8 rounded-full transition-colors"
        style={{ background: 'var(--hover-bg-light)', color: 'var(--text-dim)' }}
        title="Share"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 z-50 w-52 rounded-xl border shadow-xl overflow-hidden"
          style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={shareTwitter}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg-light)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Post on X
          </button>
          <button
            onClick={shareLinkedIn}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg-light)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            Share on LinkedIn
          </button>
          <button
            onClick={shareFacebook}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg-light)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Share on Facebook
          </button>
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={downloadCard}
              disabled={generating}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors disabled:opacity-50"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => { if (!generating) e.currentTarget.style.background = 'var(--hover-bg-light)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              {generating ? 'Generating...' : 'Download Card'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
