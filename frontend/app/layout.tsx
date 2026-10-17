import type { Metadata, Viewport } from "next";
import LangSync from "@/components/LangSync";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Saathi",
  description: "A GenAI companion for gig workers: earnings, rights, safety and complaints, in your language.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#047857" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="hi" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Applies the stored/device theme before first paint so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-fg">
        <LangSync />
        {children}
      </body>
    </html>
  );
}
