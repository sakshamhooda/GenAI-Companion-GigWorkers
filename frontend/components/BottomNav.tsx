"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getLang } from "@/lib/api";
import { t } from "@/lib/i18n";

/** Mobile tab bar (Home, Earnings, Chat, Help) with the active route marked via aria-current. */
export default function BottomNav() {
  const pathname = usePathname();
  const s = t(getLang());
  const items = [
    { href: "/home", label: s.home, icon: "🏠" },
    { href: "/earnings", label: s.earnings, icon: "₹" },
    { href: "/chat", label: s.chat, icon: "💬" },
    { href: "/grievance", label: s.help, icon: "📝" },
  ];
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
    >
      <ul className="mx-auto flex max-w-md">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center text-xs font-medium ${
                  active ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-600 dark:text-zinc-300"
                }`}
              >
                <span aria-hidden="true" className="text-lg">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
