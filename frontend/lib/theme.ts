/**
 * Light/dark theme. The choice is stored in localStorage (`saathi_theme`); when unset the
 * device preference applies. `THEME_BOOT_SCRIPT` runs inline in <head> so the first paint
 * already has the right class and there is no flash.
 */

export type Theme = "light" | "dark";
const KEY = "saathi_theme";

export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export function getTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setTheme(theme: Theme) {
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    /* storage unavailable */
  }
  applyTheme(theme);
  for (const fn of listeners) fn();
}

const listeners = new Set<() => void>();
export const subscribeTheme = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
