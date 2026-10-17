"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { applyLang } from "@/components/LangSync";
import { Button, Card, ChipGroup, ErrorText, Input, Label, Select } from "@/components/ui";
import { api, getLang, setLang, setToken, type AuthResponse } from "@/lib/api";
import { LANGUAGES, PLATFORMS, WORK_TYPES, t } from "@/lib/i18n";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    pin: "",
    language: getLang(),
    work_types: ["delivery"] as string[],
    platforms: [] as string[],
    city: "",
  });
  const s = t(form.language);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (key: "name" | "city") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  function chooseLang(code: string) {
    setLang(code);
    applyLang(code);
    setForm({ ...form, language: code });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.work_types.length === 0 || form.platforms.length === 0) {
      setError(`${s.workType} / ${s.platform}`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.post<AuthResponse>("/auth/register", form);
      setToken(res.token);
      setLang(res.user.language);
      applyLang(res.user.language);
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
            <Select id="language" value={form.language} onChange={(e) => chooseLang(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native}
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
          <ChipGroup
            id="work_types"
            label={s.workType}
            options={WORK_TYPES.map((w) => ({ value: w, label: s.workTypes[w] }))}
            value={form.work_types}
            onChange={(work_types) => setForm({ ...form, work_types })}
          />
          <ChipGroup
            id="platforms"
            label={s.platform}
            options={PLATFORMS.map((p) => ({ value: p, label: p }))}
            value={form.platforms}
            onChange={(platforms) => setForm({ ...form, platforms })}
            addLabel={s.addPlatform}
            addPlaceholder={s.addPlatformPlaceholder}
          />
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
