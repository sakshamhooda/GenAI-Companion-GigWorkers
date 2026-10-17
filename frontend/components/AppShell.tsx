"use client";

import type { ReactNode } from "react";
import AuthGuard from "@/components/AuthGuard";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";

/** Authenticated page frame: header (language, theme, profile), auth guard, content, bottom tabs. */
export default function AppShell({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <AuthGuard>
      <TopBar title={title} profileLink />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-4">
        {children}
      </main>
      <BottomNav />
    </AuthGuard>
  );
}
