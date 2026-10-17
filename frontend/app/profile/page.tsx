"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Button, Card } from "@/components/ui";
import { api, clearToken, getLang, type User } from "@/lib/api";
import { t } from "@/lib/i18n";

export default function ProfilePage() {
  const router = useRouter();
  const lang = getLang();
  const s = t(lang);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api
      .get<User>("/me")
      .then(setUser)
      .catch(() => {});
  }, []);

  function logout() {
    clearToken();
    router.replace("/");
  }

  return (
    <AppShell title={s.profile}>
      <div className="space-y-4">
        <Card>
          {!user ? (
            <p>{s.loading}</p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <dt className="text-zinc-600 dark:text-zinc-300">{s.name}</dt>
              <dd className="font-medium">{user.name}</dd>
              <dt className="text-zinc-600 dark:text-zinc-300">{s.phone}</dt>
              <dd className="font-medium">{user.phone}</dd>
              <dt className="text-zinc-600 dark:text-zinc-300">{s.workType}</dt>
              <dd className="font-medium">
                {s.workTypes[user.work_type as keyof typeof s.workTypes] ?? user.work_type}
              </dd>
              <dt className="text-zinc-600 dark:text-zinc-300">{s.platform}</dt>
              <dd className="font-medium">{user.platform}</dd>
              <dt className="text-zinc-600 dark:text-zinc-300">{s.city}</dt>
              <dd className="font-medium">{user.city}</dd>
              <dt className="text-zinc-600 dark:text-zinc-300">{s.language}</dt>
              <dd className="font-medium">{user.language}</dd>
            </dl>
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
