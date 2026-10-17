"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import QuickAdd from "@/components/QuickAdd";
import { Card } from "@/components/ui";
import { api, type EarningsSummary, type User } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Home: greeting, this week's earnings summary, quick-add, shortcuts, and the connectors card. */
export default function HomePage() {
  const s = t(useLang());
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const load = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    let active = true;
    Promise.all([api.get<User>("/me"), api.get<EarningsSummary>("/earnings?days=7")])
      .then(([u, e]) => {
        if (!active) return;
        setUser(u);
        setSummary(e);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [refreshKey]);

  return (
    <AppShell>
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{user ? `${s.greeting}, ${user.name}` : s.loading}</h2>

        <Card>
          <h3 className="text-sm font-medium text-muted">{s.thisWeek}</h3>
          <p className="mt-1 text-3xl font-extrabold text-accent">{summary ? inr(summary.net) : "—"}</p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-muted">{s.earned}</dt>
              <dd className="font-semibold">{summary ? inr(summary.total_amount) : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">{s.expenses}</dt>
              <dd className="font-semibold">{summary ? inr(summary.total_expenses) : "—"}</dd>
            </div>
          </dl>
        </Card>

        <QuickAdd onAdded={load} />

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/chat"
            className="flex min-h-14 items-center justify-center rounded-2xl bg-accent px-3 text-center text-base font-semibold text-accent-fg hover:opacity-90"
          >
            {s.askSaathi}
          </Link>
          <Link
            href="/help"
            className="flex min-h-14 items-center justify-center rounded-2xl border border-border bg-card px-3 text-center text-base font-semibold text-fg hover:bg-bg"
          >
            {s.help}
          </Link>
        </div>

        <Link href="/connectors" className="block">
          <Card className="flex items-center gap-3 hover:bg-bg">
            <span aria-hidden="true" className="text-2xl">
              🔌
            </span>
            <span>
              <span className="block font-semibold">{s.connectors}</span>
              <span className="block text-sm text-muted">{s.connectAppsText}</span>
            </span>
          </Card>
        </Link>
      </div>
    </AppShell>
  );
}
