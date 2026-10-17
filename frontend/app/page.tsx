"use client";

import Link from "next/link";
import { useState } from "react";
import { applyLang } from "@/components/LangSync";
import { Label, Select } from "@/components/ui";
import { getLang, setLang } from "@/lib/api";
import { LANGUAGES, t } from "@/lib/i18n";

export default function LandingPage() {
  const [lang, setLangState] = useState(getLang);
  const s = t(lang);

  function choose(code: string) {
    setLang(code);
    applyLang(code);
    setLangState(code);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <p className="text-5xl font-extrabold text-emerald-800 dark:text-emerald-400">{s.appName}</p>
        <p className="mt-1 text-xl font-semibold">Saathi</p>
        <p lang={lang} className="mt-4 text-base">
          {s.pitch}
        </p>
        {lang !== "en" ? (
          <p lang="en" className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            {t("en").pitch}
          </p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="landing-lang">{s.language} / Language</Label>
        <Select id="landing-lang" value={lang} onChange={(e) => choose(e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.native}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-3">
        <Link
          href="/login"
          className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-700 text-base font-semibold text-white hover:bg-emerald-800"
        >
          {s.login}
        </Link>
        <Link
          href="/register"
          className="flex min-h-12 items-center justify-center rounded-xl border border-zinc-300 bg-white text-base font-semibold text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        >
          {s.register}
        </Link>
      </div>
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        {s.demoHint}
      </p>
    </main>
  );
}
