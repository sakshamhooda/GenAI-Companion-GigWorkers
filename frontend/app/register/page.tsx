"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, setLang, setToken, type AuthResponse } from "@/lib/api";
import { LANGUAGES, PLATFORMS, t } from "@/lib/i18n";
import { Button, Card, ErrorText, Input, Label, Select } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    pin: "",
    language: "hi",
    work_type: "delivery",
    platform: "",
    city: "",
  });
  const s = t(form.language);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post<AuthResponse>("/auth/register", form);
      setToken(res.token);
      setLang(res.user.language);
      router.push("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <Card>
        <h1 className="mb-4 text-2xl font-bold">
          {s.register} <span className="text-base font-normal text-zinc-500">/ Register</span>
        </h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="language">{s.language}</Label>
            <Select id="language" value={form.language} onChange={set("language")}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="name">{s.name}</Label>
            <Input id="name" required autoComplete="name" value={form.name} onChange={set("name")} />
          </div>
          <div>
            <Label htmlFor="phone">{s.phone}</Label>
            <Input
              id="phone"
              inputMode="numeric"
              autoComplete="tel"
              pattern="[0-9]{10}"
              maxLength={10}
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
            />
          </div>
          <div>
            <Label htmlFor="pin">{s.pin}</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
            />
          </div>
          <div>
            <Label htmlFor="work_type">{s.workType}</Label>
            <Select id="work_type" value={form.work_type} onChange={set("work_type")}>
              {Object.entries(s.workTypes).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="platform">{s.platform}</Label>
            <Input id="platform" list="platforms" required value={form.platform} onChange={set("platform")} />
            <datalist id="platforms">
              {PLATFORMS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div>
            <Label htmlFor="city">{s.city}</Label>
            <Input id="city" required autoComplete="address-level2" value={form.city} onChange={set("city")} />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? s.loading : s.submit}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm">
          {s.haveAccount}{" "}
          <Link href="/login" className="font-semibold text-emerald-700 underline dark:text-emerald-400">
            {s.login}
          </Link>
        </p>
      </Card>
    </main>
  );
}
