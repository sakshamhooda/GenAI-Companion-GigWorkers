"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import GoogleButton from "@/components/GoogleButton";
import TopBar from "@/components/TopBar";
import { setLang, setToken, type AuthResponse } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";

/**
 * Landing: pitch, login/register and the Google button (real or demo). No credentials are
 * shown anywhere; the demo path is a one-tap sign-in. Language and theme controls live in
 * the header.
 */
export default function LandingPage() {
  const lang = useLang();
  const s = t(lang);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function onSignedIn(res: AuthResponse) {
    setToken(res.token);
    setLang(res.user.language);
    const needsProfile = res.is_new || res.user.platforms.length === 0;
    router.push(needsProfile ? "/register?step=2" : "/home");
  }

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
        <div className="flex flex-col items-center gap-2">
          <GoogleButton onSignedIn={onSignedIn} onError={setError} />
          {error ? (
            <p role="alert" className="text-center text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
        </div>
      </main>
    </>
  );
}
