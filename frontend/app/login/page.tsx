"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { applyLang } from "@/components/LangSync";
import { api, getLang, setLang, setToken, type AuthResponse } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button, Card, ErrorText, Input, Label } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const s = t(getLang());
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
      <Card>
        <h1 className="mb-4 text-2xl font-bold">
          {s.login} <span className="text-base font-normal text-zinc-500">/ Login</span>
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
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? s.loading : s.login}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm">
          {s.noAccount}{" "}
          <Link href="/register" className="font-semibold text-emerald-700 underline dark:text-emerald-400">
            {s.register}
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-zinc-500">Demo: 9999999999 / 1234</p>
      </Card>
    </main>
  );
}
