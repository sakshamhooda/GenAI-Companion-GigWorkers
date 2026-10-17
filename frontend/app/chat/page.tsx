"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import AppShell from "@/components/AppShell";
import MicButton from "@/components/MicButton";
import { Button, ErrorText, Input } from "@/components/ui";
import { api, getLang, type ChatMessage } from "@/lib/api";
import { t } from "@/lib/i18n";

export default function ChatPage() {
  const lang = getLang();
  const s = t(lang);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get<ChatMessage[]>("/chat/history")
      .then(setMessages)
      .catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setError("");
    setMessages((m) => [...m, { role: "user", content: message, created_at: new Date().toISOString() }]);
    setBusy(true);
    try {
      const res = await api.post<{ reply: string }>("/chat", { message });
      setMessages((m) => [...m, { role: "assistant", content: res.reply, created_at: new Date().toISOString() }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const chips = [s.chipSafety, s.chipSchemes, s.chipDocs];

  return (
    <AppShell title={s.chat}>
      <div className="flex min-h-[70vh] flex-col">
        <ul className="flex-1 space-y-3" aria-live="polite">
          {messages.map((m, i) => (
            <li key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <p
                lang={lang}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-base ${
                  m.role === "user"
                    ? "bg-emerald-700 text-white"
                    : "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                }`}
              >
                {m.content}
              </p>
            </li>
          ))}
          {busy && <li className="text-sm text-zinc-500">{s.thinking}</li>}
          <div ref={endRef} />
        </ul>

        <div className="sticky bottom-16 mt-4 space-y-2 bg-zinc-50 pb-2 dark:bg-zinc-950">
          <div className="flex gap-2 overflow-x-auto">
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => send(c)}
                className="min-h-11 whitespace-nowrap rounded-full border border-emerald-700 bg-white px-4 text-sm font-medium text-emerald-800 dark:bg-zinc-800 dark:text-emerald-300"
              >
                {c}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2"
          >
            <label htmlFor="chat-input" className="sr-only">
              {s.typeMessage}
            </label>
            <Input
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={s.typeMessage}
              autoComplete="off"
            />
            <MicButton onTranscript={(txt) => setInput((cur) => (cur.trim() ? `${cur.trim()} ${txt}` : txt))} />
            <Button type="submit" disabled={busy || !input.trim()}>
              {s.send}
            </Button>
          </form>
          <ErrorText>{error}</ErrorText>
        </div>
      </div>
    </AppShell>
  );
}
