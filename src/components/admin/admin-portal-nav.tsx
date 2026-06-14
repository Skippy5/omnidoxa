"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound, Newspaper } from "lucide-react";

const adminSections = [
  {
    label: "Article Desk",
    href: "/admin/article-desk",
    icon: Newspaper,
  },
  {
    label: "Access",
    href: "/admin/access",
    icon: KeyRound,
  },
];

export function AdminPortalNav() {
  const pathname = usePathname();

  return (
    <div className="border-y border-[var(--rule)] bg-[var(--surface)]">
      <nav className="mx-auto flex w-full max-w-7xl flex-wrap gap-2 px-4 py-3 sm:px-6 lg:px-8">
        {adminSections.map((section) => {
          const Icon = section.icon;
          const isActive = pathname === section.href;

          return (
            <Link
              key={section.href}
              href={section.href}
              className="inline-flex min-h-10 items-center gap-2 border px-4 font-mono text-xs font-semibold uppercase transition-colors data-[active=true]:border-[var(--accent)] data-[active=true]:bg-[var(--accent-strong)] data-[active=false]:border-[var(--rule)] data-[active=false]:text-[var(--heading)]"
              data-active={isActive}
            >
              <Icon size={15} />
              {section.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
