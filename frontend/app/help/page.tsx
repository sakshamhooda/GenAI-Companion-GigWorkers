"use client";

import Link from "next/link";
import AppShell from "@/components/AppShell";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";

/** Help hub: "I have a problem" (legal options) or go straight to drafting a complaint. */
export default function HelpPage() {
  const s = t(useLang());
  return (
    <AppShell title={s.help}>
      <div className="space-y-4">
        <p className="text-base text-muted">{s.helpHubText}</p>
        <Link
          href="/problem"
          className="flex min-h-20 items-center gap-3 rounded-2xl bg-accent px-4 text-lg font-semibold text-accent-fg hover:opacity-90"
        >
          <span aria-hidden="true" className="text-2xl">
            🆘
          </span>
          {s.meriSamasya}
        </Link>
        <Link
          href="/grievance"
          className="flex min-h-20 items-center gap-3 rounded-2xl border border-border bg-card px-4 text-lg font-semibold text-fg hover:bg-bg"
        >
          <span aria-hidden="true" className="text-2xl">
            📝
          </span>
          {s.draftComplaint}
        </Link>
      </div>
    </AppShell>
  );
}
