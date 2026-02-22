'use client';

import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import GameView from '@/components/ViewpointBattle/GameView';
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';

export default function GamesPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-md"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in srgb, var(--bg) 95%, transparent)',
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <Link href="/">
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{ color: 'var(--text)' }}
              >
                Omni<span className="text-purple-400">Doxa</span>
              </h1>
            </Link>
            <p
              className="text-xs tracking-widest uppercase"
              style={{ color: 'var(--text-faint)' }}
            >
              Viewpoint Battle
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <ThemeToggle />
            <Link
              href="/"
              aria-label="Back to News"
              className="flex items-center gap-1 sm:gap-2 rounded-lg border px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium transition-all hover:scale-105"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--card-bg)',
                color: 'var(--text-secondary)',
              }}
            >
              <span className="sm:hidden">←</span>
              <span className="hidden sm:inline">← Back to News</span>
            </Link>
            <SignedOut>
              <SignInButton mode="modal">
                <button
                  className="rounded-lg border px-4 py-2 text-sm font-medium transition-all hover:scale-105"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <GameView />
      </main>
    </div>
  );
}
