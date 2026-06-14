"use client";

import Link from "next/link";
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

export function AuthActions({ isEnabled }: { isEnabled: boolean }) {
  if (!isEnabled) {
    return (
      <Link
        href="/admin"
        aria-label="Account"
        title="Account"
        className="grid h-10 w-10 place-items-center rounded-full text-[var(--nav-icon)] transition-colors hover:text-[var(--heading)]"
      >
        <AccountGlyph />
      </Link>
    );
  }

  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button className="min-h-10 border border-[var(--rule)] px-4 font-mono text-xs uppercase text-[var(--heading)] transition-colors hover:border-[var(--accent)]">
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="hidden min-h-10 border border-[var(--rule-strong)] bg-[var(--button-bg)] px-4 font-mono text-xs uppercase text-[var(--button-text)] transition-opacity hover:opacity-90 sm:inline-flex sm:items-center">
            Join
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-10 w-10",
            },
          }}
        />
      </Show>
    </>
  );
}

function AccountGlyph() {
  return (
    <span className="relative block h-7 w-7 rounded-full border-2 border-current">
      <span className="absolute left-1/2 top-1.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-current" />
      <span className="absolute bottom-1.5 left-1/2 h-2.5 w-4 -translate-x-1/2 rounded-t-full border-2 border-current border-b-0" />
    </span>
  );
}
