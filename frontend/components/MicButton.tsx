"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api, getLang, type Transcript } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";

const MAX_SECONDS = 30;

type Props = {
  onTranscript: (text: string, detectedLang: string | null) => void;
  size?: "md" | "lg";
  className?: string;
};

type State = "idle" | "recording" | "transcribing";

/** Press to record a voice note (max 30 s), press again to stop. Sends it to /voice/transcribe. */
export default function MicButton({ onTranscript, size = "md", className = "" }: Props) {
  const s = t(useLang());
  const [state, setState] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const supported = useSyncExternalStore(
    () => () => {},
    () => typeof window.MediaRecorder !== "undefined",
    () => false,
  );
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => stopTimer(), []);

  function stopTimer() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined;
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        stopTimer();
        await send(new Blob(chunks.current, { type: rec.mimeType || "audio/webm" }));
      };
      recorder.current = rec;
      rec.start();
      setSeconds(0);
      setState("recording");
      timer.current = setInterval(() => {
        setSeconds((n) => {
          if (n + 1 >= MAX_SECONDS) stop();
          return n + 1;
        });
      }, 1000);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setError(name === "NotAllowedError" || name === "SecurityError" ? s.micDenied : s.micUnsupported);
      setState("idle");
    }
  }

  function stop() {
    const rec = recorder.current;
    if (rec && rec.state !== "inactive") rec.stop();
    recorder.current = null;
  }

  async function send(blob: Blob) {
    setState("transcribing");
    try {
      const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
      const form = new FormData();
      form.append("file", blob, `note.${ext}`);
      form.append("language", getLang());
      const res = await api.upload<Transcript>("/voice/transcribe", form);
      if (res.transcript.trim()) onTranscript(res.transcript.trim(), res.language_code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setState("idle");
    }
  }

  if (!supported) return null;

  const recording = state === "recording";
  const label = state === "recording" ? s.stopRecording : state === "transcribing" ? s.transcribing : s.speak;
  const dims = size === "lg" ? "h-20 w-20" : "h-11 w-11";

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <button
        type="button"
        aria-pressed={recording}
        aria-label={label}
        disabled={state === "transcribing"}
        onClick={recording ? stop : start}
        className={`flex ${dims} items-center justify-center rounded-full border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-60 ${
          recording
            ? "border-red-600 bg-red-50 text-red-700 dark:bg-red-950"
            : "border-emerald-700 bg-white text-emerald-800 hover:bg-emerald-50 dark:bg-zinc-800 dark:text-emerald-300"
        }`}
      >
        {state === "transcribing" ? (
          <span
            className={`${size === "lg" ? "h-8 w-8" : "h-5 w-5"} animate-spin rounded-full border-2 border-current border-t-transparent`}
            aria-hidden="true"
          />
        ) : recording ? (
          <span className={`${size === "lg" ? "h-6 w-6" : "h-4 w-4"} animate-pulse rounded-sm bg-red-600`} aria-hidden="true" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={size === "lg" ? "h-9 w-9" : "h-5 w-5"}
            aria-hidden="true"
          >
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <path d="M12 17v4M8 21h8" />
          </svg>
        )}
      </button>
      <span className="text-xs text-zinc-600 dark:text-zinc-400" aria-live="polite">
        {state === "recording" ? `${s.listening} ${seconds}s` : state === "transcribing" ? s.transcribing : size === "lg" ? s.speak : ""}
      </span>
      {error ? (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
