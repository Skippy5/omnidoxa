import Link from "next/link";
import { isClerkConfigured } from "@/lib/auth-config";
import { getCategoryHref, newsCategories } from "@/lib/topic-types";
import { AuthActions } from "./auth-actions";
import { ThemeToggle } from "./theme-toggle";

export function SiteNav() {
  const authEnabled = isClerkConfigured();

  return (
    <header className="bg-[var(--page)]">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-5 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-7 lg:gap-10">
          <Link
            href="/"
            className="shrink-0 font-serif text-xl font-bold tracking-normal text-[var(--heading)] sm:text-2xl"
          >
            OmniDoxa
          </Link>
          <nav className="hidden items-center gap-5 lg:flex xl:gap-7">
            {newsCategories.map((category) => (
              <Link
                key={category}
                href={getCategoryHref(category)}
                className="font-serif text-sm italic tracking-normal text-[var(--muted)] transition-colors hover:text-[var(--heading)] xl:text-base"
              >
                {category}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/briefing"
            className="hidden min-h-10 items-center border border-[var(--rule-strong)] bg-[var(--button-bg)] px-5 font-mono text-xs text-[var(--button-text)] transition-opacity hover:opacity-90 sm:inline-flex"
          >
            Daily Briefing
          </Link>
          <ThemeToggle />
          <AuthActions isEnabled={authEnabled} />
        </div>
      </div>
    </header>
  );
}
