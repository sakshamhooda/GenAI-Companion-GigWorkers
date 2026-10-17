"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { applyLang } from "@/components/LangSync";
import MicButton from "@/components/MicButton";
import { Button, Card, ChipGroup, ErrorText, Input, Label, Select, Textarea } from "@/components/ui";
import { api, getLang, setLang, setToken, type AuthResponse, type OnboardingParse } from "@/lib/api";
import { isSupportedLang, LANGUAGES, PLATFORMS, WORK_TYPES, t } from "@/lib/i18n";

type Step = 1 | 2 | 3;

type Profile = {
  name: string;
  language: string;
  work_types: string[];
  platforms: string[];
  city: string;
  shift: string;
  memory: string;
};

const emptyProfile = (language: string): Profile => ({
  name: "",
  language,
  work_types: [],
  platforms: [],
  city: "",
  shift: "",
  memory: "",
});

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [lang, setLangState] = useState(getLang());
  const [story, setStory] = useState("");
  const [detected, setDetected] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(() => emptyProfile(getLang()));
  const [login, setLogin] = useState({ phone: "", pin: "", pin2: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const s = t(lang);

  function switchLang(code: string) {
    setLang(code);
    applyLang(code);
    setLangState(code);
  }

  function chooseLang(code: string) {
    switchLang(code);
    setProfile({ ...profile, language: code });
  }

  function applyDetected(code: string | null) {
    const short = code?.split("-")[0] ?? null;
    if (short && short !== lang && isSupportedLang(short)) {
      setDetected(short);
      switchLang(short);
      setProfile((p) => ({ ...p, language: short }));
    }
  }

  async function parseStory(e: FormEvent) {
    e.preventDefault();
    if (!story.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.post<OnboardingParse>("/onboarding/parse", { text: story, language_hint: lang });
      const language = res.language && isSupportedLang(res.language) ? res.language : lang;
      setProfile({
        name: res.name ?? "",
        language,
        work_types: res.work_types ?? [],
        platforms: res.platforms ?? [],
        city: res.city ?? "",
        shift: res.shift ?? "",
        memory: res.memory ?? "",
      });
      if (language !== lang) {
        setDetected(language);
        switchLang(language);
      }
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function confirmProfile(e: FormEvent) {
    e.preventDefault();
    if (profile.work_types.length === 0 || profile.platforms.length === 0 || !profile.name.trim() || !profile.city.trim()) {
      setError(`${s.name} / ${s.workType} / ${s.platform} / ${s.city}`);
      return;
    }
    setError("");
    setStep(3);
  }

  async function createAccount(e: FormEvent) {
    e.preventDefault();
    if (login.pin !== login.pin2) {
      setError(s.pinMismatch);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { pin2: _unused, ...creds } = login;
      void _unused;
      const res = await api.post<AuthResponse>("/auth/register", {
        ...creds,
        name: profile.name.trim(),
        language: profile.language,
        work_types: profile.work_types,
        platforms: profile.platforms,
        city: profile.city.trim(),
        shift: profile.shift || undefined,
        memory: profile.memory || undefined,
      });
      setToken(res.token);
      switchLang(res.user.language);
      router.push("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <Card>
        <StepIndicator step={step} label={s.step} />

        {step === 1 && (
          <form onSubmit={parseStory} className="space-y-4">
            <h1 className="text-2xl font-bold">{s.onboardTitle}</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{s.onboardHint}</p>
            <div className="flex justify-end">
              <Select id="lang1" aria-label={s.language} value={lang} onChange={(e) => chooseLang(e.target.value)} className="w-auto">
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.native}
                  </option>
                ))}
              </Select>
            </div>
            <MicButton
              size="lg"
              className="py-2"
              onTranscript={(txt, code) => {
                setStory((cur) => (cur.trim() ? `${cur.trim()} ${txt}` : txt));
                applyDetected(code);
              }}
            />
            <div>
              <Label htmlFor="story">{s.onboardTitle}</Label>
              <Textarea id="story" value={story} onChange={(e) => setStory(e.target.value)} placeholder={s.onboardExample} lang={lang} />
            </div>
            {detected ? (
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                {s.detectedLang}: {LANGUAGES.find((l) => l.code === detected)?.native ?? detected}
              </p>
            ) : null}
            <ErrorText>{error}</ErrorText>
            <Button type="submit" className="w-full" disabled={busy || !story.trim()}>
              {busy ? s.loading : s.next}
            </Button>
            <button
              type="button"
              className="min-h-11 w-full text-sm font-medium text-emerald-800 underline dark:text-emerald-300"
              onClick={() => {
                setProfile(emptyProfile(lang));
                setError("");
                setStep(2);
              }}
            >
              {s.skipType}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={confirmProfile} className="space-y-4">
            <h1 className="text-2xl font-bold">{s.confirmTitle}</h1>
            <div>
              <Label htmlFor="name">{s.name}</Label>
              <Input id="name" required autoComplete="name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="language">{s.language}</Label>
              <Select id="language" value={profile.language} onChange={(e) => chooseLang(e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.native}
                  </option>
                ))}
              </Select>
            </div>
            <ChipGroup
              id="work_types"
              label={s.workType}
              options={WORK_TYPES.map((w) => ({ value: w, label: s.workTypes[w] }))}
              value={profile.work_types}
              onChange={(work_types) => setProfile({ ...profile, work_types })}
            />
            <ChipGroup
              id="platforms"
              label={s.platform}
              options={PLATFORMS.map((p) => ({ value: p, label: p }))}
              value={profile.platforms}
              onChange={(platforms) => setProfile({ ...profile, platforms })}
              addLabel={s.addPlatform}
              addPlaceholder={s.addPlatformPlaceholder}
            />
            <div>
              <Label htmlFor="city">{s.city}</Label>
              <Input id="city" required autoComplete="address-level2" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950">
              <Label htmlFor="memory">{s.willRemember}</Label>
              <Textarea
                id="memory"
                className="min-h-20 bg-white dark:bg-zinc-900"
                value={profile.memory}
                onChange={(e) => setProfile({ ...profile, memory: e.target.value })}
                lang={profile.language}
              />
            </div>
            <ErrorText>{error}</ErrorText>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                {s.back}
              </Button>
              <Button type="submit" className="flex-1">
                {s.looksRight}
              </Button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={createAccount} className="space-y-4">
            <h1 className="text-2xl font-bold">{s.loginTitle}</h1>
            <div>
              <Label htmlFor="phone">{s.phone}</Label>
              <Input
                id="phone"
                inputMode="numeric"
                autoComplete="tel"
                pattern="[0-9]{10}"
                maxLength={10}
                required
                value={login.phone}
                onChange={(e) => setLogin({ ...login, phone: e.target.value.replace(/\D/g, "") })}
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
                value={login.pin}
                onChange={(e) => setLogin({ ...login, pin: e.target.value.replace(/\D/g, "") })}
              />
            </div>
            <div>
              <Label htmlFor="pin2">{s.confirmPin}</Label>
              <Input
                id="pin2"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                required
                value={login.pin2}
                onChange={(e) => setLogin({ ...login, pin2: e.target.value.replace(/\D/g, "") })}
              />
            </div>
            <ErrorText>{error}</ErrorText>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                {s.back}
              </Button>
              <Button type="submit" className="flex-1" disabled={busy}>
                {busy ? s.loading : s.createAccount}
              </Button>
            </div>
          </form>
        )}

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

function StepIndicator({ step, label }: { step: Step; label: string }) {
  return (
    <ol className="mb-4 flex items-center gap-2" aria-label={`${label} ${step} / 3`}>
      {[1, 2, 3].map((n) => (
        <li
          key={n}
          aria-current={n === step ? "step" : undefined}
          className={`h-2 flex-1 rounded-full ${n <= step ? "bg-emerald-700" : "bg-zinc-200 dark:bg-zinc-700"}`}
        />
      ))}
      <span className="ml-2 text-xs text-zinc-600 dark:text-zinc-400">
        {label} {step}/3
      </span>
    </ol>
  );
}
