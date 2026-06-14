"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";

export function AdminAccessPanel({
  isSignedIn,
  isAuthConfigured,
}: {
  isSignedIn: boolean;
  isAuthConfigured: boolean;
}) {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="border border-[var(--rule)] bg-[var(--surface)] p-6 sm:p-8">
        <p className="font-mono text-[10px] font-semibold uppercase text-[var(--accent)]">
          Admin Access
        </p>
        <h1 className="mt-3 font-serif text-4xl font-bold italic leading-tight text-[var(--heading)] sm:text-5xl">
          Editorial desk requires an invited account.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--copy)]">
          Admin permissions are granted by email and checked server-side before
          any article fetch, Topic write, or publish action runs.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          {isAuthConfigured ? (
            <>
              <SignInButton mode="modal">
                <button className="min-h-11 border border-[var(--rule-strong)] bg-[var(--button-bg)] px-5 font-mono text-xs uppercase text-[var(--button-text)]">
                  {isSignedIn ? "Switch account" : "Sign in"}
                </button>
              </SignInButton>
              {!isSignedIn ? (
                <SignUpButton mode="modal">
                  <button className="min-h-11 border border-[var(--rule)] px-5 font-mono text-xs uppercase text-[var(--heading)]">
                    Create account
                  </button>
                </SignUpButton>
              ) : null}
            </>
          ) : (
            <p className="border border-[var(--rule)] bg-[var(--page)] px-4 py-3 font-mono text-xs uppercase text-[var(--muted)]">
              Clerk is not configured
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
