"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import QuickAdd from "@/components/QuickAdd";
import { Card } from "@/components/ui";
import { api, getLang, type EarningsSummary, type User } from "@/lib/api";
import { t } from "@/lib/i18n";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Home: greeting, this week's earnings summary, quick-add, and shortcuts to chat and help. */
export default function HomePage() {
  const s = t(getLang());
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
        <h2 className="text-xl font-bold">
          {user ? `${s.greeting}, ${user.name}` : s.loading}
        </h2>

        <Card>
          <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{s.thisWeek}</h3>
          <p className="mt-1 text-3xl font-extrabold text-emerald-800 dark:text-emerald-400">
            {summary ? inr(summary.net) : "—"}
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-zinc-600 dark:text-zinc-300">{s.earned}</dt>
              <dd className="font-semibold">{summary ? inr(summary.total_amount) : "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-600 dark:text-zinc-300">{s.expenses}</dt>
              <dd className="font-semibold">{summary ? inr(summary.total_expenses) : "—"}</dd>
            </div>
          </dl>
        </Card>

        <QuickAdd onAdded={load} />

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/chat"
            className="flex min-h-14 items-center justify-center rounded-2xl bg-emerald-700 px-3 text-center text-base font-semibold text-white hover:bg-emerald-800"
          >
            {s.askSaathi}
          </Link>
          <Link
            href="/grievance"
            className="flex min-h-14 items-center justify-center rounded-2xl border border-zinc-300 bg-white px-3 text-center text-base font-semibold text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {s.draftComplaint}
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
