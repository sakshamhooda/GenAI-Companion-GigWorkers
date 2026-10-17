"use client";

import { useEffect, useRef, useState } from "react";
import { api, type AuthResponse } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GSI_SRC = "https://accounts.google.com/gsi/client";

type GsiCredential = { credential: string };

type GoogleAccountsId = {
  initialize: (config: { client_id: string; callback: (r: GsiCredential) => void }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

/** What the backend says about Google sign-in: real (client id configured) or demo. */
export type GoogleConfig = { enabled: boolean; demo: boolean };

function loadGsi(): Promise<GoogleAccountsId> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google.accounts.id);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    const script = existing ?? document.createElement("script");
    const onLoad = () => {
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error("Google script loaded without accounts.id"));
    };
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", () => reject(new Error("Could not load Google sign-in")), {
      once: true,
    });
    if (!existing) {
      script.src = GSI_SRC;
      script.async = true;
      document.head.appendChild(script);
    } else if (window.google?.accounts?.id) {
      onLoad();
    }
  });
}

type Props = {
  /** Called with the auth response; caller decides where to navigate. */
  onSignedIn: (res: AuthResponse) => void | Promise<void>;
  onError?: (message: string) => void;
  label?: string;
};

type Mode = "loading" | "real" | "demo" | "off";

/**
 * Google sign-in. Asks the backend which mode applies: the real Google Identity button when a
 * client id is configured on both sides, a styled demo button when the backend allows demo
 * sign-in, or nothing.
 */
export default function GoogleButton({ onSignedIn, onError, label }: Props) {
  const s = t(useLang());
  const host = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("loading");

  useEffect(() => {
    let cancelled = false;
    api
      .get<GoogleConfig>("/auth/google/config")
      .then((cfg) => {
        if (cancelled) return;
        if (cfg.enabled && CLIENT_ID) setMode("real");
        else if (cfg.demo) setMode("demo");
        else setMode("off");
      })
      .catch(() => {
        if (!cancelled) setMode(CLIENT_ID ? "real" : "off");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function finish(credential: string) {
    setBusy(true);
    try {
      const res = await api.post<AuthResponse>("/auth/google", { credential });
      await onSignedIn(res);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  useEffect(() => {
    if (mode !== "real" || !CLIENT_ID || !host.current) return;
    let cancelled = false;
    const el = host.current;
    loadGsi()
      .then((gsi) => {
        if (cancelled) return;
        gsi.initialize({ client_id: CLIENT_ID, callback: ({ credential }) => finish(credential) });
        gsi.renderButton(el, {
          theme: "outline",
          size: "large",
          width: Math.min(el.clientWidth || 320, 400),
          text: "continue_with",
          shape: "pill",
        });
      })
      .catch((err: Error) => onError?.(err.message));
    return () => {
      cancelled = true;
    };
    // The real button is initialised once per mount; callbacks are read at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (mode === "off" || mode === "loading") return null;

  if (mode === "demo") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => finish("demo")}
        className="flex min-h-11 w-full max-w-sm items-center justify-center gap-3 self-center rounded-full border border-border bg-card px-4 text-base font-medium text-fg hover:bg-bg disabled:opacity-50"
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.5 13.3l7.8 6C12.2 13.4 17.6 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z" />
          <path fill="#FBBC05" d="M10.3 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.5 10.7l7.8-6z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.4 0-11.8-3.9-13.7-9.5l-7.8 6C6.5 42.6 14.6 48 24 48z" />
        </svg>
        {busy ? s.loading : s.continueWithGoogleDemo}
      </button>
    );
  }

  return (
    <div aria-busy={busy} aria-label={label} className="flex min-h-11 w-full justify-center">
      <div ref={host} className="w-full max-w-sm" />
    </div>
  );
}
