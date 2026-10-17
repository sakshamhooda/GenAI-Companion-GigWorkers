"use client";

import Link from "next/link";
import TopBar from "@/components/TopBar";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";

/** Landing: pitch, login/register, demo hint. Language and theme controls live in the header. */
export default function LandingPage() {
  const lang = useLang();
  const s = t(lang);

  return (
    <>
      <TopBar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
        <div className="text-center">
          <p className="text-5xl font-extrabold text-accent">{s.appName}</p>
          <p className="mt-1 text-xl font-semibold">Saathi</p>
          <p lang={lang} className="mt-4 text-base">
            {s.pitch}
          </p>
          {lang !== "en" ? (
            <p lang="en" className="mt-2 text-sm text-muted">
              {t("en").pitch}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="flex min-h-12 items-center justify-center rounded-xl bg-accent text-base font-semibold text-accent-fg hover:opacity-90"
          >
            {s.login}
          </Link>
          <Link
            href="/register"
            className="flex min-h-12 items-center justify-center rounded-xl border border-border bg-card text-base font-semibold text-fg hover:bg-bg"
          >
            {s.register}
          </Link>
        </div>
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          {s.demoHint}
        </p>
      </main>
    </>
  );
}
