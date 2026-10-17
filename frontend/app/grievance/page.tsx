"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import AppShell from "@/components/AppShell";
import { Button, Card, ErrorText, Label, Select, Textarea } from "@/components/ui";
import { ApiError, api, type Grievance } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";

function DraftCard({ title, text, lang, copyLabel, copiedLabel }: {
  title: string;
  text: string;
  lang: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <Button type="button" variant="secondary" onClick={copy}>
          {copied ? copiedLabel : copyLabel}
        </Button>
      </div>
      <p lang={lang} className="whitespace-pre-wrap text-base">
        {text}
      </p>
    </Card>
  );
}

const KNOWN_KINDS = ["payout_deduction", "unfair_deactivation", "wage_nonpayment", "safety_incident", "other"];

/** Grievance form. `?kind=` and `?text=` (from the problem page) prefill it. */
function GrievanceForm() {
  const lang = useLang();
  const s = t(lang);
  const params = useSearchParams();
  const initialKind = params.get("kind") ?? "";
  const [kind, setKind] = useState(KNOWN_KINDS.includes(initialKind) ? initialKind : "other");
  const [description, setDescription] = useState(params.get("text") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Grievance | null>(null);
  const [past, setPast] = useState<Grievance[]>([]);

  const loadPast = () =>
    api
      .get<Grievance[]>("/grievances")
      .then(setPast)
      .catch(() => {});

  useEffect(() => {
    loadPast();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post<Grievance>("/grievances/draft", { kind, description });
      setResult(res);
      loadPast();
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) setError(s.aiBusy);
      else setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="kind">{s.kind}</Label>
            <Select id="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(s.kinds).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="description">{s.describe}</Label>
            <Textarea id="description" required value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" disabled={busy || !description.trim()}>
            {busy ? s.thinking : s.draft}
          </Button>
        </form>
      </Card>

      {result && (
        <>
          <DraftCard title={s.draftLocal} text={result.draft_local} lang={lang} copyLabel={s.copy} copiedLabel={s.copied} />
          <DraftCard title={s.draftEnglish} text={result.draft_english} lang="en" copyLabel={s.copy} copiedLabel={s.copied} />
        </>
      )}

      {past.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold">{s.pastDrafts}</h3>
          <ul className="space-y-2">
            {past.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setResult(g)}
                  className="min-h-11 w-full rounded-xl border border-border bg-card p-3 text-left"
                >
                  <p className="font-medium">{s.kinds[g.kind as keyof typeof s.kinds] ?? g.kind}</p>
                  <p className="line-clamp-1 text-sm text-muted">{g.description}</p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Help: draft a grievance in the worker's language and formal English, copy it, see past drafts. */
export default function GrievancePage() {
  const s = t(useLang());
  return (
    <AppShell title={s.draftComplaint}>
      <Suspense fallback={<p>{s.loading}</p>}>
        <GrievanceForm />
      </Suspense>
    </AppShell>
  );
}
