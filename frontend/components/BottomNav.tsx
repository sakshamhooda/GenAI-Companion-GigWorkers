"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/lib/i18n";
import { useLang } from "@/lib/useLang";

const HELP_ROUTES = ["/help", "/problem", "/grievance"];

/** Mobile tab bar (Home, Earnings, Analytics, Chat, Help) with the active route marked via aria-current. */
export default function BottomNav() {
  const pathname = usePathname();
  const s = t(useLang());
  const items = [
    { href: "/home", label: s.home, icon: "🏠", match: (p: string) => p === "/home" },
    { href: "/earnings", label: s.earnings, icon: "₹", match: (p: string) => p === "/earnings" },
    { href: "/analytics", label: s.analytics, icon: "📊", match: (p: string) => p === "/analytics" },
    { href: "/chat", label: s.chat, icon: "💬", match: (p: string) => p === "/chat" },
    { href: "/help", label: s.help, icon: "🛟", match: (p: string) => HELP_ROUTES.includes(p) },
  ];
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card">
      <ul className="mx-auto flex max-w-md">
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center px-1 text-[11px] font-medium leading-tight ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <span aria-hidden="true" className="text-lg">
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
