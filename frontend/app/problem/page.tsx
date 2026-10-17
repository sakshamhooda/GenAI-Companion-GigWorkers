"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import AppShell from "@/components/AppShell";
import MicButton from "@/components/MicButton";
import SpeakButton from "@/components/SpeakButton";
import { Badge, Button, Card, ErrorText, Label, Textarea } from "@/components/ui";
import { ApiError, api, type ProblemRecord, type ProblemResult, type User } from "@/lib/api";
import { t, type Strings } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";

function urgencyTone(u: string) {
  return u === "high" ? "bad" : u === "medium" ? "warn" : "good";
}

function label(map: Record<string, string>, key: string) {
  return map[key] ?? key;
}

/** Structured result: summary, rights, options, contacts, disclaimer, next-step buttons. */
function ResultView({ r, s, lang, onRemember, remembered }: { r: ProblemResult; s: Strings; lang: string; onRemember: () => void; remembered: boolean }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-2 flex items-center justify-between gap-2">
          <Badge tone={urgencyTone(r.urgency)}>{label(s.urgency, r.urgency)}</Badge>
          <span className="flex items-center gap-2 text-xs text-muted">
            {r.category}
            <SpeakButton text={r.summary} lang={lang} size="md" />
          </span>
        </div>
        <p lang={lang} className="text-base">
          {r.summary}
        </p>
      </Card>

      {r.rights.length > 0 ? (
        <Card>
          <h3 className="mb-2 font-semibold">{s.yourRights}</h3>
          <ul className="space-y-2">
            {r.rights.map((x) => (
              <li key={x.kb_id} lang={lang}>
                <p className="font-medium">{x.title}</p>
                <p className="text-sm text-muted">{x.what_it_says}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {r.options.length > 0 ? (
        <Card>
          <h3 className="mb-2 font-semibold">{s.options}</h3>
          <ul className="space-y-2">
            {r.options.map((o, i) => (
              <li key={i} className="rounded-xl border border-border">
                <button
                  type="button"
                  aria-expanded={open === i}
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left"
                >
                  <span lang={lang} className="font-medium">
                    {i + 1}. {o.title}
                  </span>
                  <span aria-hidden="true">{open === i ? "▾" : "▸"}</span>
                </button>
                <div className="flex justify-end px-3 pb-1">
                  <SpeakButton text={[o.title, ...o.steps].join(". ")} lang={lang} size="sm" />
                </div>
                {open === i ? (
                  <div className="space-y-2 px-3 pb-3 text-sm" lang={lang}>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{s.effortLabel}: {label(s.effort, o.effort)}</Badge>
                      <Badge>{s.time}: {o.time}</Badge>
                      <Badge>{s.cost}: {o.cost}</Badge>
                    </div>
                    {o.steps.length > 0 ? (
                      <div>
                        <p className="font-medium">{s.steps}</p>
                        <ol className="list-decimal space-y-1 pl-5">
                          {o.steps.map((st, j) => (
                            <li key={j}>{st}</li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                    {o.documents.length > 0 ? (
                      <div>
                        <p className="font-medium">{s.documents}</p>
                        <ul className="list-disc space-y-1 pl-5">
                          {o.documents.map((d, j) => (
                            <li key={j}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {r.contacts.length > 0 ? (
        <Card>
          <h3 className="mb-2 font-semibold">{s.contacts}</h3>
          <ul className="space-y-2">
            {r.contacts.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span>{c.name}</span>
                <a href={`tel:${c.number.replace(/\s+/g, "")}`} className="min-h-11 rounded-xl bg-accent px-4 py-2 font-semibold text-accent-fg">
                  📞 {c.number}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="text-xs text-muted" lang={lang}>
        {r.disclaimer}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/grievance?kind=${encodeURIComponent(r.category)}&text=${encodeURIComponent(r.summary)}`}
          className="flex min-h-12 items-center justify-center rounded-xl bg-accent px-3 text-center font-semibold text-accent-fg hover:opacity-90"
        >
          {s.draftComplaint}
        </Link>
        <Button type="button" variant="secondary" onClick={onRemember} disabled={remembered}>
          {remembered ? s.remembered : s.rememberThis}
        </Button>
      </div>
    </div>
  );
}

/** "Meri samasya": describe a problem by voice or text and get rights, options and contacts. */
export default function ProblemPage() {
  const lang = useLang();
  const s = t(lang);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ProblemResult | null>(null);
  const [remembered, setRemembered] = useState(false);
  const [past, setPast] = useState<ProblemRecord[]>([]);

  const loadPast = () =>
    api
      .get<ProblemRecord[]>("/problems")
      .then(setPast)
      .catch(() => {});

  useEffect(() => {
    loadPast();
  }, []);

  async function analyze(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    setRemembered(false);
    try {
      setResult(await api.post<ProblemResult>("/problems/analyze", { text }));
      loadPast();
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) setError(s.aiBusy);
      else setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function remember() {
    if (!result) return;
    try {
      const me = await api.get<User>("/me");
      const line = `[${new Date().toISOString().slice(0, 10)}] ${result.category}: ${result.summary}`;
      const memory = `${me.memory?.trim() ?? ""}\n${line}`.trim();
      await api.put("/me", { memory });
      setRemembered(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <AppShell title={s.meriSamasya}>
      <div className="space-y-4">
        <Card>
          <form onSubmit={analyze} className="space-y-3">
            <Label htmlFor="problem-text">{s.problemTitle}</Label>
            <div className="flex items-start gap-2">
              <Textarea
                id="problem-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={s.problemPlaceholder}
                required
              />
              <MicButton size="lg" onTranscript={(txt) => setText((prev) => (prev ? `${prev} ${txt}` : txt))} />
            </div>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" className="w-full" disabled={busy || !text.trim()}>
              {busy ? s.thinking : s.analyze}
            </Button>
          </form>
        </Card>

        {result ? <ResultView r={result} s={s} lang={lang} onRemember={remember} remembered={remembered} /> : null}

        {past.length > 0 ? (
          <section>
            <h3 className="mb-2 font-semibold">{s.pastProblems}</h3>
            <ul className="space-y-2">
              {past.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setResult(p.result);
                      setRemembered(false);
                    }}
                    className="min-h-11 w-full rounded-xl border border-border bg-card p-3 text-left"
                  >
                    <p className="font-medium">{p.category}</p>
                    <p className="line-clamp-1 text-sm text-muted">{p.text}</p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
