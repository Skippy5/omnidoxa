'use client';

import { useEffect, useRef } from 'react';

interface AdBannerProps {
  slot: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal' | 'vertical';
  layout?: string;
  className?: string;
}

// Replace with real AdSense publisher ID once Skip has his account
const PUBLISHER_ID = 'ca-pub-XXXXXXXXXX';

/**
 * Google AdSense ad unit component.
 * Currently using placeholder IDs — replace PUBLISHER_ID and slot values
 * once Skip's AdSense account is approved.
 */
export default function AdBanner({ 
  slot, 
  format = 'auto', 
  layout,
  className = '' 
}: AdBannerProps) {
  const adRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    // Don't initialize if placeholder IDs or already initialized
    if (PUBLISHER_ID.includes('XXXXXXXXXX')) return;
    if (initialized.current) return;
    
    try {
      initialized.current = true;
      // @ts-expect-error adsbygoogle is a global
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('AdSense error:', err);
    }
  }, []);

  // Show a subtle placeholder when using test IDs
  if (PUBLISHER_ID.includes('XXXXXXXXXX')) {
    return (
      <div className={`overflow-hidden rounded-xl border border-dashed p-4 text-center ${className}`} style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}>
        <p className="text-xs italic" style={{ color: 'var(--text-faint)' }}>
          📢 Ad space — awaiting AdSense setup
        </p>
      </div>
    );
  }

  return (
    <div ref={adRef} className={`overflow-hidden ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={PUBLISHER_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        {...(layout ? { 'data-ad-layout': layout } : {})}
        data-full-width-responsive="true"
      />
    </div>
  );
}

/**
 * In-feed ad unit — designed to sit between article cards.
 * Uses fluid format to match surrounding content.
 */
export function InFeedAd({ className = '' }: { className?: string }) {
  return (
    <AdBanner
      slot="SLOT_INFEED_PLACEHOLDER"
      format="fluid"
      layout="in-article"
      className={className}
    />
  );
}
