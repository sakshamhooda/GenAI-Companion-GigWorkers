import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// 'unsafe-inline' for scripts/styles is required by Next.js's runtime without nonces.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com",
  "frame-src https://accounts.google.com",
  `connect-src 'self' ${API_URL} https://accounts.google.com`,
  "img-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline'",
  "media-src 'self' blob:",
  "font-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Standalone output keeps the Docker image small (see frontend/Dockerfile).
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
