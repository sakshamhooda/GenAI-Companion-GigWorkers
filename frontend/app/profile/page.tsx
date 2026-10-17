"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import AppShell from "@/components/AppShell";
import { applyLang } from "@/components/LangSync";
import { Button, Card, ChipGroup, ErrorText, Input, Label, Select } from "@/components/ui";
import { api, clearToken, getLang, setLang, type User } from "@/lib/api";
import { LANGUAGES, PLATFORMS, WORK_TYPES, t } from "@/lib/i18n";

type Editable = Pick<User, "name" | "language" | "work_types" | "platforms" | "city">;

/** Profile: editable name, language, work types, platforms, city; memory note; WhatsApp (coming soon); logout. */
export default function ProfilePage() {
  const router = useRouter();
  const [lang, setLangState] = useState(getLang);
  const s = t(lang);
  const [user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState<Editable | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<User>("/me")
      .then((u) => {
        setUser(u);
        setForm({
          name: u.name,
          language: u.language,
          work_types: u.work_types ?? [],
          platforms: u.platforms ?? [],
          city: u.city,
        });
      })
      .catch(() => {});
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const u = await api.put<User>("/me", form);
      setUser(u);
      setLang(u.language);
      applyLang(u.language);
      setLangState(u.language);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    clearToken();
    router.replace("/");
  }

  return (
    <AppShell title={s.profile}>
      <div className="space-y-4">
        <Card>
          {!form ? (
            <p>{s.loading}</p>
          ) : (
            <form onSubmit={save} className="space-y-4">
              <div>
                <Label htmlFor="p-name">{s.name}</Label>
                <Input id="p-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="p-phone">{s.phone}</Label>
                <Input id="p-phone" readOnly value={user?.phone ?? ""} />
              </div>
              <div>
                <Label htmlFor="p-language">{s.language}</Label>
                <Select
                  id="p-language"
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.native}
                    </option>
                  ))}
                </Select>
              </div>
              <ChipGroup
                id="p-work_types"
                label={s.workType}
                options={WORK_TYPES.map((w) => ({ value: w, label: s.workTypes[w] }))}
                value={form.work_types}
                onChange={(work_types) => setForm({ ...form, work_types })}
              />
              <ChipGroup
                id="p-platforms"
                label={s.platform}
                options={PLATFORMS.map((p) => ({ value: p, label: p }))}
                value={form.platforms}
                onChange={(platforms) => setForm({ ...form, platforms })}
                addLabel={s.addPlatform}
                addPlaceholder={s.addPlatformPlaceholder}
              />
              <div>
                <Label htmlFor="p-city">{s.city}</Label>
                <Input id="p-city" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <ErrorText>{error}</ErrorText>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? s.loading : saved ? s.saved : s.save}
              </Button>
            </form>
          )}
        </Card>

        <Card>
          <h3 className="mb-2 font-semibold">{s.whatSaathiKnows}</h3>
          <p lang={lang} className="whitespace-pre-wrap text-sm">
            {user?.memory?.trim() ? user.memory : s.nothingYet}
          </p>
        </Card>

        <Card className="border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950">
          <h3 className="mb-1 font-semibold">
            <span aria-hidden="true">🟢</span> {s.connectWhatsapp}
          </h3>
          <p className="mb-3 text-sm">{s.whatsappText}</p>
          <label htmlFor="wa-phone" className="sr-only">
            {s.phone}
          </label>
          <input
            id="wa-phone"
            readOnly
            value={user?.phone ?? ""}
            className="mb-3 min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base dark:border-zinc-600 dark:bg-zinc-800"
          />
          <Button type="button" disabled className="w-full">
            {s.comingSoon}
          </Button>
        </Card>

        <Button type="button" variant="secondary" className="w-full" onClick={logout}>
          {s.logout}
        </Button>
      </div>
    </AppShell>
  );
}
