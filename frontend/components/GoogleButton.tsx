"use client";

import { useEffect, useRef, useState } from "react";
import { api, type AuthResponse } from "@/lib/api";

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

/** Renders Google's standard sign-in button. Renders nothing when no client id is set. */
export default function GoogleButton({ onSignedIn, onError, label }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID || !host.current) return;
    let cancelled = false;
    const el = host.current;
    loadGsi()
      .then((gsi) => {
        if (cancelled) return;
        gsi.initialize({
          client_id: CLIENT_ID,
          callback: async ({ credential }) => {
            setBusy(true);
            try {
              const res = await api.post<AuthResponse>("/auth/google", { credential });
              await onSignedIn(res);
            } catch (err) {
              onError?.(err instanceof Error ? err.message : "Google sign-in failed");
              setBusy(false);
            }
          },
        });
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
    // onSignedIn/onError are stable enough for a one-time init; re-running would re-render the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!CLIENT_ID) return null;
  return (
    <div aria-busy={busy} aria-label={label} className="flex min-h-11 w-full justify-center">
      <div ref={host} className="w-full max-w-sm" />
    </div>
  );
}
