"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ApiError, api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";

type Props = {
  text: string;
  lang?: string;
  size?: "sm" | "md";
  className?: string;
};

type State = "idle" | "loading" | "playing";

/** The one audio element playing right now; starting another button stops it. */
let current: { audio: HTMLAudioElement; reset: () => void } | null = null;

function stopCurrent() {
  if (!current) return;
  const { audio, reset } = current;
  current = null;
  audio.pause();
  audio.currentTime = 0;
  reset();
}

/** Reads `text` aloud via POST /voice/speak. One button plays at a time; a second press stops. */
export default function SpeakButton({ text, lang, size = "sm", className = "" }: Props) {
  const uiLang = useLang();
  const s = t(uiLang);
  const [state, setState] = useState<State>("idle");
  const [note, setNote] = useState("");
  const cache = useRef<{ text: string; blob: Blob } | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supported = useSyncExternalStore(
    () => () => {},
    () => typeof Audio !== "undefined",
    () => false,
  );

  // Stable identity so the module-level `current` can tell which button owns the audio.
  const reset = useCallback(() => setState("idle"), []);

  useEffect(
    () => () => {
      if (noteTimer.current) clearTimeout(noteTimer.current);
      if (current && current.reset === reset) stopCurrent();
    },
    [reset],
  );

  function flash(message: string) {
    setNote(message);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(""), 3000);
  }

  async function play() {
    stopCurrent();
    setState("loading");
    try {
      let blob = cache.current?.text === text ? cache.current.blob : null;
      if (!blob) {
        blob = await api.postBlob("/voice/speak", { text, language: lang ?? uiLang });
        cache.current = { text, blob };
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      const done = () => {
        URL.revokeObjectURL(url);
        if (current?.audio === audio) current = null;
        setState("idle");
      };
      audio.onended = done;
      audio.onerror = done;
      current = { audio, reset };
      setState("playing");
      await audio.play();
    } catch (err) {
      setState("idle");
      flash(err instanceof ApiError && err.status === 503 ? s.ttsUnavailable : err instanceof Error ? err.message : s.ttsUnavailable);
    }
  }

  function stop() {
    if (current && current.reset === reset) stopCurrent();
    else setState("idle");
  }

  if (!supported) return null;

  const playing = state === "playing";
  const dims = size === "md" ? "h-11 w-11" : "h-11 w-11";
  const icon = size === "md" ? "h-6 w-6" : "h-5 w-5";

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        aria-pressed={playing}
        aria-label={playing ? s.stop : s.listen}
        title={playing ? s.stop : s.listen}
        disabled={state === "loading"}
        onClick={playing ? stop : play}
        className={`flex ${dims} items-center justify-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 ${
          playing ? "border-accent bg-accent text-accent-fg" : "border-border bg-card text-fg hover:bg-bg"
        }`}
      >
        {state === "loading" ? (
          <span className={`${icon} animate-spin rounded-full border-2 border-current border-t-transparent`} aria-hidden="true" />
        ) : playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className={icon} aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={icon} aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </svg>
        )}
      </button>
      {note ? (
        <span role="status" className="text-xs text-muted">
          {note}
        </span>
      ) : null}
    </span>
  );
}
