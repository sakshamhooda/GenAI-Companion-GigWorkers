"use client";

import { useEffect } from "react";
import { getLang } from "@/lib/api";
import { RTL_LANGS } from "@/lib/i18n";

/** Apply the chosen language to <html lang> and dir. Call `applyLang` after changing the stored language. */
export function applyLang(code: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = code;
  document.documentElement.dir = RTL_LANGS.includes(code) ? "rtl" : "ltr";
}

export default function LangSync() {
  useEffect(() => {
    applyLang(getLang());
  }, []);
  return null;
}
