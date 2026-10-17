"use client";

import { applyLang } from "@/components/LangSync";
import { api, getToken, setLang } from "@/lib/api";
import { LANGUAGES, t } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";

/**
 * Compact language select shown in every header. Changing it re-renders the chrome
 * immediately and, when the worker is logged in, saves the choice to their profile.
 */
export default function LangSwitcher({ className = "" }: { className?: string }) {
  const lang = useLang();
  const s = t(lang);

  function choose(code: string) {
    setLang(code);
    applyLang(code);
    if (getToken()) {
      api.put("/me", { language: code }).catch(() => {});
    }
  }

  return (
    <label className={`inline-flex items-center ${className}`}>
      <span className="sr-only">{s.language}</span>
      <select
        aria-label={s.language}
        value={lang}
        onChange={(e) => choose(e.target.value)}
        className="min-h-11 max-w-28 rounded-xl border border-border bg-card px-2 text-sm font-medium text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  );
}
