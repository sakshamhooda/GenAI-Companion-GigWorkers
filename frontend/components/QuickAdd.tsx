"use client";

import { useState, type FormEvent } from "react";
import { api, getLang, type Earning, type ParsedEarning } from "@/lib/api";
import { t } from "@/lib/i18n";
import MicButton from "@/components/MicButton";
import { Button, Card, ErrorText, Input, Label } from "@/components/ui";

export default function QuickAdd({ onAdded }: { onAdded: () => void }) {
  const s = t(getLang());
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedEarning | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function parse(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      setParsed(await api.post<ParsedEarning>("/earnings/parse", { text }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    if (!parsed) return;
    setBusy(true);
    setError("");
    try {
      const { platform, ...rest } = parsed;
      await api.post<Earning>("/earnings", platform ? { ...rest, platform } : rest);
      setParsed(null);
      setText("");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      {!parsed ? (
        <form onSubmit={parse} className="space-y-2">
          <Label htmlFor="quickadd">{s.quickAddLabel}</Label>
          <div className="flex gap-2">
            <Input
              id="quickadd"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={s.quickAddPlaceholder}
              autoComplete="off"
            />
            <MicButton onTranscript={(txt) => setText(txt)} />
            <Button type="submit" disabled={busy || !text.trim()}>
              {busy ? "…" : s.parse}
            </Button>
          </div>
          <ErrorText>{error}</ErrorText>
        </form>
      ) : (
        <form onSubmit={confirm} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="qa-amount">{s.amount}</Label>
              <Input
                id="qa-amount"
                type="number"
                inputMode="decimal"
                value={parsed.amount}
                onChange={(e) => setParsed({ ...parsed, amount: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="qa-expenses">{s.expenses}</Label>
              <Input
                id="qa-expenses"
                type="number"
                inputMode="decimal"
                value={parsed.expenses}
                onChange={(e) => setParsed({ ...parsed, expenses: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="qa-platform">{s.platform}</Label>
              <Input
                id="qa-platform"
                value={parsed.platform ?? ""}
                onChange={(e) => setParsed({ ...parsed, platform: e.target.value || null })}
              />
            </div>
            <div>
              <Label htmlFor="qa-date">{s.date}</Label>
              <Input
                id="qa-date"
                type="date"
                value={parsed.date}
                onChange={(e) => setParsed({ ...parsed, date: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="qa-note">{s.note}</Label>
            <Input
              id="qa-note"
              value={parsed.note ?? ""}
              onChange={(e) => setParsed({ ...parsed, note: e.target.value })}
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy} className="flex-1">
              {s.confirm}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setParsed(null)}>
              {s.cancel}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
