"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Badge, Button, Card } from "@/components/ui";
import { api, type Analytics } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const hrs = (n: number) => `${Math.round(n * 10) / 10}h`;

/** Pure-SVG bar chart of net earnings per day, with an sr-only table fallback. */
function DayBars({ days, title }: { days: Analytics["by_day"]; title: string }) {
  const max = Math.max(1, ...days.map((d) => d.net));
  const w = 320;
  const h = 120;
  const gap = 4;
  const bw = Math.max(2, (w - gap * (days.length + 1)) / Math.max(1, days.length));
  return (
    <>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" role="img" aria-labelledby="daybars-title">
        <title id="daybars-title">{title}</title>
        {days.map((d, i) => {
          const bh = Math.max(2, (d.net / max) * (h - 20));
          const x = gap + i * (bw + gap);
          return <rect key={d.date} x={x} y={h - 16 - bh} width={bw} height={bh} rx={2} className="fill-accent" />;
        })}
        <line x1={0} x2={w} y1={h - 16} y2={h - 16} className="stroke-border" strokeWidth={1} />
      </svg>
      <ul className="sr-only">
        {days.map((d) => (
          <li key={d.date}>
            {d.date}: {inr(d.net)}, {hrs(d.hours)}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Insights: totals, per-platform comparison, day-by-day bars and a one-line model insight. */
export default function AnalyticsPage() {
  const lang = useLang();
  const s = t(lang);
  const [days, setDaysState] = useState<7 | 30>(7);
  const [data, setData] = useState<Analytics | null>(null);
  const setDays = (d: 7 | 30) => {
    setDaysState(d);
    setData(null);
  };
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get<Analytics>(`/earnings/analytics?days=${days}`)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed");
      });
    return () => {
      active = false;
    };
  }, [days]);

  const maxNet = data ? Math.max(1, ...data.by_platform.map((p) => p.net)) : 1;

  return (
    <AppShell title={s.analytics}>
      <div className="space-y-4">
        <div className="flex gap-2" role="group" aria-label={s.analytics}>
          {([7, 30] as const).map((d) => (
            <Button key={d} type="button" variant={days === d ? "primary" : "secondary"} aria-pressed={days === d} onClick={() => setDays(d)} className="flex-1">
              {d === 7 ? s.last7 : s.last30}
            </Button>
          ))}
        </div>

        {error ? <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p> : null}
        {!data && !error ? <p>{s.loading}</p> : null}

        {data && data.by_platform.length === 0 ? (
          <Card>
            <p>{s.noData}</p>
          </Card>
        ) : null}

        {data && data.by_platform.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Card className="p-3">
                <p className="text-xs text-muted">{s.net}</p>
                <p className="text-xl font-extrabold text-accent">{inr(data.totals.net)}</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted">{s.hours}</p>
                <p className="text-xl font-extrabold">{hrs(data.totals.hours)}</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted">{s.netPerHour}</p>
                <p className="text-xl font-extrabold">{data.totals.net_per_hour != null ? inr(data.totals.net_per_hour) : "—"}</p>
              </Card>
            </div>

            {data.insight ? (
              <Card className="border-accent/50">
                <h3 className="mb-1 text-sm font-semibold text-muted">{s.insight}</h3>
                <p lang={lang} className="text-base">
                  {data.insight}
                </p>
              </Card>
            ) : null}

            <Card>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">{s.byPlatform}</h3>
                {data.best_platform ? (
                  <Badge tone="good">
                    {s.bestPlatform}: {data.best_platform}
                  </Badge>
                ) : null}
              </div>
              <table className="w-full text-sm">
                <thead className="sr-only">
                  <tr>
                    <th>{s.platform}</th>
                    <th>{s.net}</th>
                    <th>{s.hours}</th>
                    <th>{s.netPerHour}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.by_platform]
                    .sort((a, b) => (b.net_per_hour ?? -1) - (a.net_per_hour ?? -1))
                    .map((p) => (
                      <tr key={p.platform} className="border-t border-border">
                        <td className="py-2 pr-2 font-medium">{p.platform}</td>
                        <td className="py-2 pr-2">
                          <div className="h-2 w-full rounded bg-bg" aria-hidden="true">
                            <div className="h-2 rounded bg-accent" style={{ width: `${Math.max(4, (p.net / maxNet) * 100)}%` }} />
                          </div>
                          <span className="text-xs text-muted">{inr(p.net)}</span>
                        </td>
                        <td className="py-2 pr-2 text-right">{hrs(p.hours)}</td>
                        <td className="py-2 text-right font-semibold">{p.net_per_hour != null ? inr(p.net_per_hour) : "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </Card>

            <Card>
              <h3 className="mb-2 font-semibold">{s.byDay}</h3>
              <DayBars days={data.by_day} title={s.byDay} />
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
