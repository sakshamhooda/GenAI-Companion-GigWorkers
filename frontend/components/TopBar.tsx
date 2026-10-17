"use client";

import Link from "next/link";
import LangSwitcher from "@/components/LangSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";

/** Sticky header with the page title, language switcher, theme toggle and an optional profile link. */
export default function TopBar({ title, profileLink = false }: { title?: string; profileLink?: boolean }) {
  const s = t(useLang());
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-2">
        <h1 className="truncate text-lg font-bold text-accent">{title ?? s.appName}</h1>
        <div className="flex items-center gap-2">
          <LangSwitcher />
          <ThemeToggle />
          {profileLink ? (
            <Link
              href="/profile"
              aria-label={s.profile}
              title={s.profile}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-card text-fg hover:bg-bg"
            >
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
