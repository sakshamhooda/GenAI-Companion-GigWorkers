"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import GoogleButton from "@/components/GoogleButton";
import { applyLang } from "@/components/LangSync";
import TopBar from "@/components/TopBar";
import { api, setLang, setToken, type AuthResponse } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";
import { Button, Card, ErrorText, Input, Label, PinInput } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const s = t(useLang());
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function onGoogle(res: AuthResponse) {
    setToken(res.token);
    setLang(res.user.language);
    applyLang(res.user.language);
    const needsProfile = res.is_new || res.user.platforms.length === 0;
    router.push(needsProfile ? "/register?step=2" : "/home");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post<AuthResponse>("/auth/login", { phone, pin });
      setToken(res.token);
      setLang(res.user.language);
      applyLang(res.user.language);
      router.push("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
        <Card>
          <h1 className="mb-4 text-2xl font-bold">
            {s.login} <span className="text-base font-normal text-muted">/ Login</span>
          </h1>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="phone">{s.phone} / Phone</Label>
              <Input
                id="phone"
                inputMode="numeric"
                autoComplete="tel"
                pattern="[0-9]{10}"
                maxLength={10}
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div>
              <Label htmlFor="pin">{s.pin} / PIN</Label>
              <PinInput
                id="pin"
                autoComplete="one-time-code"
                required
                value={pin}
                onChange={setPin}
                showLabel={s.showPin}
                hideLabel={s.hidePin}
              />
            </div>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? s.loading : s.login}
            </Button>
          </form>
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 text-xs uppercase text-muted">
              <span className="h-px flex-1 bg-border" />
              {s.or}
              <span className="h-px flex-1 bg-border" />
            </div>
            <GoogleButton label={s.continueWithGoogle} onSignedIn={onGoogle} onError={setError} />
          </div>
          <p className="mt-4 text-center text-sm">
            {s.noAccount}{" "}
            <Link href="/register" className="font-semibold text-accent underline">
              {s.register}
            </Link>
          </p>
        </Card>
      </main>
    </>
  );
}
