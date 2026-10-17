"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import AuthGuard from "@/components/AuthGuard";
import BottomNav from "@/components/BottomNav";
import { getLang } from "@/lib/api";
import { t } from "@/lib/i18n";

export default function AppShell({ title, children }: { title?: string; children: ReactNode }) {
  const s = t(getLang());
  return (
    <AuthGuard>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-emerald-800 dark:text-emerald-400">{title ?? s.appName}</h1>
          <Link href="/profile" className="min-h-11 rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            {s.profile}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-20 pt-4">{children}</main>
      <BottomNav />
    </AuthGuard>
  );
}
