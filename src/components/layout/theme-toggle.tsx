"use client";

import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggleTheme}
      className="group grid h-8 w-8 place-items-center rounded-full border border-transparent text-[var(--nav-icon)] transition-colors hover:border-[var(--rule-strong)] hover:text-[var(--heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
    >
      <span
        aria-hidden="true"
        className={
          isDark
            ? "block h-4 w-4 rounded-full border-2 border-current shadow-[-5px_0_0_-1px_var(--page)]"
            : "relative block h-4 w-4 rounded-full border-2 border-current before:absolute before:left-1/2 before:top-[-6px] before:h-1 before:w-px before:-translate-x-1/2 before:bg-current after:absolute after:left-1/2 after:bottom-[-6px] after:h-1 after:w-px after:-translate-x-1/2 after:bg-current"
        }
      />
    </button>
  );
}
