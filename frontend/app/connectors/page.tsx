"use client";

import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { Badge, Button, Card, ErrorText, Input, Label } from "@/components/ui";
import { api, type ConnectResult, type Connector, type ScreenshotEntry, type ScreenshotImport } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";

type Proposed = ScreenshotEntry & { platform: string; done: boolean };

/** Connectors: screenshot import (real), a demo connector, and coming-soon platform cards. */
export default function ConnectorsPage() {
  const s = t(useLang());
  const [items, setItems] = useState<Connector[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [synced, setSynced] = useState<Record<string, number>>({});
  const [proposed, setProposed] = useState<Proposed[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = () =>
    api
      .get<Connector[]>("/connectors")
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"));

  useEffect(() => {
    load();
  }, []);

  async function connect(c: Connector) {
    setBusyId(c.id);
    setError("");
    try {
      const res = await api.post<ConnectResult>(`/connectors/${c.id}/connect`);
      if (res.synced !== undefined) setSynced((m) => ({ ...m, [c.id]: res.synced ?? 0 }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function disconnect(c: Connector) {
    setBusyId(c.id);
    setError("");
    try {
      await api.delete(`/connectors/${c.id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function importScreenshot(file: File) {
    setBusyId("screenshot");
    setError("");
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      const res = await api.upload<ScreenshotImport>("/connectors/screenshot/import", form);
      setProposed(res.entries.map((e) => ({ ...e, platform: res.platform ?? "", done: false })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmEntry(i: number) {
    const e = proposed[i];
    const body: Record<string, unknown> = { date: e.date, amount: e.amount, expenses: e.expenses, note: e.note ?? "" };
    if (e.platform) body.platform = e.platform;
    if (e.hours != null) body.hours = e.hours;
    await api.post("/earnings", body);
    setProposed((list) => list.map((x, j) => (j === i ? { ...x, done: true } : x)));
  }

  async function confirmAll() {
    for (let i = 0; i < proposed.length; i++) {
      if (!proposed[i].done) await confirmEntry(i);
    }
  }

  const kindTone = (k: Connector["kind"]) => (k === "available" ? "good" : k === "demo" ? "warn" : "neutral");
  const kindLabel = (k: Connector["kind"]) => (k === "available" ? s.available : k === "demo" ? s.demo : s.comingSoon);

  return (
    <AppShell title={s.connectors}>
      <div className="space-y-4">
        <p className="text-sm text-muted">{s.connectorsIntro}</p>
        <ErrorText>{error}</ErrorText>
        {!items ? <p>{s.loading}</p> : null}

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label={s.importScreenshot}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importScreenshot(f);
            e.target.value = "";
          }}
        />

        {items?.map((c) => (
          <Card key={c.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="text-2xl">
                  {c.icon}
                </span>
                <div>
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="text-sm text-muted">{c.description}</p>
                </div>
              </div>
              <Badge tone={kindTone(c.kind)}>{kindLabel(c.kind)}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {c.kind === "available" && c.id === "screenshot" ? (
                <Button type="button" disabled={busyId === "screenshot"} onClick={() => fileInput.current?.click()}>
                  {busyId === "screenshot" ? s.loading : s.importScreenshot}
                </Button>
              ) : null}
              {c.kind === "demo" ? (
                c.status === "connected" ? (
                  <>
                    <Badge tone="good">{s.connected}</Badge>
                    {synced[c.id] !== undefined ? (
                      <span className="text-sm text-muted">
                        {synced[c.id]} {s.synced}
                      </span>
                    ) : null}
                    <Button type="button" variant="secondary" disabled={busyId === c.id} onClick={() => disconnect(c)}>
                      {s.disconnect}
                    </Button>
                  </>
                ) : (
                  <Button type="button" disabled={busyId === c.id} onClick={() => connect(c)}>
                    {busyId === c.id ? s.loading : s.connect}
                  </Button>
                )
              ) : null}
              {c.kind === "coming_soon" ? (
                c.status === "interested" ? (
                  <Badge tone="good">{s.willTell}</Badge>
                ) : (
                  <Button type="button" variant="secondary" disabled={busyId === c.id} onClick={() => connect(c)}>
                    {s.notifyMe}
                  </Button>
                )
              ) : null}
            </div>
          </Card>
        ))}

        {proposed.length > 0 ? (
          <Card>
            <h3 className="mb-2 font-semibold">{s.proposedEntries}</h3>
            <ul className="space-y-3">
              {proposed.map((e, i) => (
                <li key={i} className="rounded-xl border border-border p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor={`pe-date-${i}`}>{s.date}</Label>
                      <Input id={`pe-date-${i}`} type="date" value={e.date} disabled={e.done} onChange={(ev) => setProposed((l) => l.map((x, j) => (j === i ? { ...x, date: ev.target.value } : x)))} />
                    </div>
                    <div>
                      <Label htmlFor={`pe-amount-${i}`}>{s.amount}</Label>
                      <Input id={`pe-amount-${i}`} type="number" inputMode="decimal" value={e.amount} disabled={e.done} onChange={(ev) => setProposed((l) => l.map((x, j) => (j === i ? { ...x, amount: Number(ev.target.value) } : x)))} />
                    </div>
                    <div>
                      <Label htmlFor={`pe-platform-${i}`}>{s.platform}</Label>
                      <Input id={`pe-platform-${i}`} value={e.platform} disabled={e.done} onChange={(ev) => setProposed((l) => l.map((x, j) => (j === i ? { ...x, platform: ev.target.value } : x)))} />
                    </div>
                    <div>
                      <Label htmlFor={`pe-hours-${i}`}>{s.hours}</Label>
                      <Input id={`pe-hours-${i}`} type="number" inputMode="decimal" step={0.5} value={e.hours ?? ""} disabled={e.done} onChange={(ev) => setProposed((l) => l.map((x, j) => (j === i ? { ...x, hours: ev.target.value === "" ? null : Number(ev.target.value) } : x)))} />
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    {e.done ? <Badge tone="good">✓ {s.confirm}</Badge> : (
                      <Button type="button" variant="secondary" onClick={() => confirmEntry(i)}>
                        {s.confirm}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {proposed.some((e) => !e.done) ? (
              <Button type="button" className="mt-3 w-full" onClick={confirmAll}>
                {s.confirmAll}
              </Button>
            ) : null}
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
