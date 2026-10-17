"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import QuickAdd from "@/components/QuickAdd";
import { Card } from "@/components/ui";
import { api, type EarningsSummary } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Earnings: last 30 days of entries with totals and hours, plus quick-add. */
export default function EarningsPage() {
  const s = t(useLang());
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const load = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    let active = true;
    api
      .get<EarningsSummary>("/earnings?days=30")
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [refreshKey]);

  return (
    <AppShell title={s.earnings}>
      <div className="space-y-4">
        <QuickAdd onAdded={load} />
        <Card>
          {!summary ? (
            <p>{s.loading}</p>
          ) : summary.entries.length === 0 ? (
            <p>{s.noEntries}</p>
          ) : (
            <ul className="divide-y divide-border">
              {summary.entries.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{e.platform}</p>
                    <p className="text-sm text-muted">
                      {e.date}
                      {e.hours != null ? ` · ${e.hours}h` : ""}
                      {e.note ? ` · ${e.note}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-accent">{inr(e.amount)}</p>
                    {e.expenses > 0 && <p className="text-sm text-red-700 dark:text-red-400">-{inr(e.expenses)}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
