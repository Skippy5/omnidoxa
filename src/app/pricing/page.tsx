'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useProStatus } from '@/lib/useProStatus';
import ThemeToggle from '@/components/ThemeToggle';

const FEATURES_FREE = [
  'Up to 50 stories per refresh',
  '10 news categories',
  'Left / Center / Right viewpoints',
  'Sentiment analysis',
  'Share cards',
];

const FEATURES_PRO = [
  'Everything in Free, plus:',
  'Ad-free experience',
  'Unlimited story history',
  'Custom feed layout',
  'Priority refresh',
  'Early access to new features',
];

function PricingContent() {
  const [loading, setLoading] = useState<'monthly' | 'yearly' | null>(null);
  const { isPro, activate, loaded } = useProStatus();
  const searchParams = useSearchParams();

  // Handle Stripe redirect
  useEffect(() => {
    const success = searchParams.get('success');
    const plan = searchParams.get('plan') as 'monthly' | 'yearly' | null;
    const sessionId = searchParams.get('session_id');

    if (success === 'true' && plan && sessionId) {
      activate(plan, sessionId);
    }
  }, [searchParams, activate]);

  const handleCheckout = async (plan: 'monthly' | 'yearly') => {
    setLoading(plan);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to start checkout');
        setLoading(null);
      }
    } catch {
      alert('Failed to connect to checkout. Make sure STRIPE_SECRET_KEY is configured.');
      setLoading(null);
    }
  };

  const success = searchParams.get('success') === 'true';
  const canceled = searchParams.get('canceled') === 'true';

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {/* Success / Cancel banners */}
      {success && (
        <div className="mb-8 rounded-xl border border-green-500/30 bg-green-500/10 px-6 py-4 text-center">
          <p className="text-lg font-semibold text-green-400">Welcome to OmniDoxa Pro!</p>
          <p className="mt-1 text-sm text-green-400/70">Your subscription is now active. Enjoy the full experience.</p>
        </div>
      )}
      {canceled && (
        <div className="mb-8 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-6 py-4 text-center">
          <p className="text-sm text-yellow-400">Checkout was canceled. No charges were made.</p>
        </div>
      )}

      {/* Hero */}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold mb-3" style={{ color: 'var(--text)' }}>
          Choose Your Plan
        </h2>
        <p className="text-lg" style={{ color: 'var(--text-muted)' }}>
          Get the most out of OmniDoxa with a Pro subscription
        </p>
      </div>

      {/* Pricing cards */}
      <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
        {/* Free tier */}
        <div
          className="rounded-2xl border p-6 flex flex-col"
          style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}
        >
          <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text)' }}>Free</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>For casual readers</p>
          <div className="mb-6">
            <span className="text-4xl font-bold" style={{ color: 'var(--text)' }}>$0</span>
            <span className="text-sm ml-1" style={{ color: 'var(--text-dim)' }}>/month</span>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            {FEATURES_FREE.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/"
            className="block w-full rounded-lg border py-2.5 text-center text-sm font-medium transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Current Plan
          </Link>
        </div>

        {/* Monthly Pro */}
        <div
          className="rounded-2xl border-2 p-6 flex flex-col relative"
          style={{ borderColor: '#a855f7', background: 'var(--card-bg)' }}
        >
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-purple-500 px-4 py-1 text-xs font-bold text-white">
            MOST POPULAR
          </div>
          <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text)' }}>Pro Monthly</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Full access, billed monthly</p>
          <div className="mb-6">
            <span className="text-4xl font-bold" style={{ color: 'var(--text)' }}>$4.99</span>
            <span className="text-sm ml-1" style={{ color: 'var(--text-dim)' }}>/month</span>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            {FEATURES_PRO.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
          {loaded && isPro ? (
            <div className="w-full rounded-lg bg-purple-500/20 border border-purple-500/40 py-2.5 text-center text-sm font-medium text-purple-400">
              Active
            </div>
          ) : (
            <button
              onClick={() => handleCheckout('monthly')}
              disabled={loading !== null}
              className="w-full rounded-lg bg-purple-500 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-purple-600 disabled:opacity-50"
            >
              {loading === 'monthly' ? 'Redirecting...' : 'Subscribe Monthly'}
            </button>
          )}
        </div>

        {/* Yearly Pro */}
        <div
          className="rounded-2xl border p-6 flex flex-col"
          style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}
        >
          <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text)' }}>Pro Annual</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Save 18% with annual billing</p>
          <div className="mb-6">
            <span className="text-4xl font-bold" style={{ color: 'var(--text)' }}>$49</span>
            <span className="text-sm ml-1" style={{ color: 'var(--text-dim)' }}>/year</span>
            <span className="ml-2 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
              Save $10.88
            </span>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            {FEATURES_PRO.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
          {loaded && isPro ? (
            <div className="w-full rounded-lg bg-purple-500/20 border border-purple-500/40 py-2.5 text-center text-sm font-medium text-purple-400">
              Active
            </div>
          ) : (
            <button
              onClick={() => handleCheckout('yearly')}
              disabled={loading !== null}
              className="w-full rounded-lg border border-purple-500 py-2.5 text-center text-sm font-bold text-purple-400 transition-colors hover:bg-purple-500/10 disabled:opacity-50"
            >
              {loading === 'yearly' ? 'Redirecting...' : 'Subscribe Annually'}
            </button>
          )}
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-16 max-w-2xl mx-auto">
        <h3 className="text-xl font-semibold text-center mb-6" style={{ color: 'var(--text)' }}>
          Frequently Asked Questions
        </h3>
        <div className="space-y-4">
          {[
            { q: 'Can I cancel anytime?', a: 'Yes. Cancel your subscription at any time from your Stripe customer portal. You\'ll retain access until the end of your billing period.' },
            { q: 'What payment methods do you accept?', a: 'We accept all major credit cards, debit cards, and Apple Pay / Google Pay through Stripe\'s secure checkout.' },
            { q: 'What does "unlimited story history" mean?', a: 'Free users see the latest 50 stories per refresh. Pro users can access the full archive of previously fetched stories.' },
          ].map(({ q, a }) => (
            <div key={q} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}>
              <p className="font-medium text-sm mb-1" style={{ color: 'var(--text)' }}>{q}</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{a}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
              Omni<span className="text-purple-400">Doxa</span>
            </h1>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-all"
              style={{ borderColor: 'var(--border)', background: 'var(--card-bg)', color: 'var(--text-secondary)' }}
            >
              Back to News
            </Link>
          </div>
        </div>
      </header>

      <Suspense fallback={
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-purple-400" style={{ borderColor: 'var(--border)', borderTopColor: '#a855f7' }} />
        </div>
      }>
        <PricingContent />
      </Suspense>
    </div>
  );
}
