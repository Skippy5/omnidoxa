import Link from "next/link";

const footerLinks = [
  { label: "Topics", href: "/#topics" },
  { label: "Briefing", href: "/briefing" },
  { label: "Games", href: "/games" },
  { label: "Admin", href: "/admin" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--rule)] bg-[var(--footer)] px-5 py-12 sm:px-8 lg:px-10">
      <div className="mx-auto grid w-full max-w-7xl gap-8 md:grid-cols-[1fr_auto]">
        <div>
          <Link
            href="/"
            className="font-serif text-xl font-bold text-[var(--heading)]"
          >
            OmniDoxa
          </Link>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--copy)]">
            Topic-first news intelligence for tracking how public discourse
            forms across political viewpoints.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-8 gap-y-3 font-mono text-xs font-semibold uppercase text-[var(--subtle)]">
          {footerLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:text-[var(--heading)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
