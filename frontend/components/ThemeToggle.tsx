"use client";

import { useSyncExternalStore } from "react";
import { getTheme, setTheme, subscribeTheme } from "@/lib/theme";
import { useLang } from "@/lib/useLang";
import { t } from "@/lib/i18n";

/** Sun/moon button that switches between light and dark and remembers the choice. */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const s = t(useLang());
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => "light" as const);
  const dark = theme === "dark";
  return (
    <button
      type="button"
      aria-pressed={dark}
      aria-label={dark ? s.lightMode : s.darkMode}
      title={dark ? s.lightMode : s.darkMode}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-card text-fg hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`}
    >
      {dark ? (
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
