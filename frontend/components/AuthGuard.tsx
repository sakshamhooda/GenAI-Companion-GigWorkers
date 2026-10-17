"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { getToken } from "@/lib/api";

const subscribe = () => () => {};

export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const authed = useSyncExternalStore(subscribe, () => Boolean(getToken()), () => false);

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  if (!authed) return null;
  return <>{children}</>;
}
