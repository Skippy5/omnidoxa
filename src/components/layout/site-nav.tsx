import Link from "next/link";
import { getCategoryHref, newsCategories } from "@/lib/placeholder-topics";
import { ThemeToggle } from "./theme-toggle";

export function SiteNav() {
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
          <Link
            href="/admin"
            aria-label="Account"
            title="Account"
            className="grid h-10 w-10 place-items-center rounded-full text-[var(--nav-icon)] transition-colors hover:text-[var(--heading)]"
          >
            <span className="relative block h-7 w-7 rounded-full border-2 border-current">
              <span className="absolute left-1/2 top-1.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-current" />
              <span className="absolute bottom-1.5 left-1/2 h-2.5 w-4 -translate-x-1/2 rounded-t-full border-2 border-current border-b-0" />
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
