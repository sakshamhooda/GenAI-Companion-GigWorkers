"use client";

import { useSyncExternalStore } from "react";
import { getLang, subscribeLang } from "@/lib/api";
import { DEFAULT_LANG } from "@/lib/i18n";

/** Current UI language; re-renders the caller when it changes anywhere in the app. */
export function useLang(): string {
  return useSyncExternalStore(subscribeLang, getLang, () => DEFAULT_LANG);
}
