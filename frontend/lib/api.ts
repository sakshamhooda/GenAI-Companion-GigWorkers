import { DEFAULT_LANG, isSupportedLang } from "@/lib/i18n";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "saathi_token";
const LANG_KEY = "saathi_lang";

export type User = {
  id: number;
  phone: string | null;
  email?: string | null;
  name: string;
  language: string;
  work_types: string[];
  platforms: string[];
  city: string;
  memory: string | null;
  role?: string;
};

export type AuthResponse = { token: string; user: User; is_new?: boolean };

export type Earning = {
  id: number;
  date: string;
  amount: number;
  expenses: number;
  hours?: number | null;
  platform: string;
  note: string | null;
};

export type EarningsSummary = {
  entries: Earning[];
  total_amount: number;
  total_expenses: number;
  net: number;
};

export type ParsedEarning = {
  amount: number;
  expenses: number;
  hours?: number | null;
  platform: string | null;
  date: string;
  note: string | null;
};

export type PlatformStats = {
  platform: string;
  amount: number;
  expenses: number;
  net: number;
  hours: number;
  net_per_hour: number | null;
  entries: number;
};

export type Analytics = {
  days: number;
  totals: { amount: number; expenses: number; net: number; hours: number; net_per_hour: number | null };
  by_platform: PlatformStats[];
  by_day: { date: string; net: number; hours: number }[];
  best_platform: string | null;
  insight: string;
};

export type Connector = {
  id: string;
  name: string;
  kind: "available" | "demo" | "coming_soon";
  description: string;
  icon: string;
  status: "connected" | "interested" | "none";
};

export type ConnectResult = { status: Connector["status"]; synced?: number };

export type ScreenshotEntry = {
  date: string;
  amount: number;
  expenses: number;
  hours: number | null;
  note: string | null;
};

export type ScreenshotImport = { platform: string | null; entries: ScreenshotEntry[] };

export type ProblemResult = {
  category: string;
  urgency: "low" | "medium" | "high" | string;
  summary: string;
  rights: { kb_id: string; title: string; what_it_says: string }[];
  options: {
    title: string;
    effort: "low" | "medium" | "high" | string;
    time: string;
    cost: string;
    steps: string[];
    documents: string[];
  }[];
  contacts: { name: string; number: string }[];
  disclaimer: string;
};

export type ProblemRecord = {
  id: number;
  category: string;
  text: string;
  result: ProblemResult;
  created_at: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type Transcript = {
  transcript: string;
  language_code: string | null;
  language_probability: number | null;
  provider: string;
};

export type OnboardingParse = {
  name: string | null;
  language: string | null;
  work_types: string[];
  platforms: string[];
  city: string | null;
  shift: string | null;
  years_experience: number | null;
  memory: string | null;
};

export type Grievance = {
  id: number;
  kind: string;
  description: string;
  draft_local: string;
  draft_english: string;
  created_at: string;
};

function safeGet(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null) {
  try {
    if (typeof window === "undefined") return;
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

export const getToken = () => safeGet(TOKEN_KEY);
export const setToken = (t: string) => safeSet(TOKEN_KEY, t);
export const clearToken = () => {
  safeSet(TOKEN_KEY, null);
  safeSet(LANG_KEY, null);
  notifyLang();
};

/** Listeners re-rendered by `useLang()` whenever the stored language changes. */
const langListeners = new Set<() => void>();
function notifyLang() {
  for (const fn of langListeners) fn();
}

export const subscribeLang = (fn: () => void) => {
  langListeners.add(fn);
  return () => {
    langListeners.delete(fn);
  };
};

export const getLang = () => {
  const stored = safeGet(LANG_KEY);
  return isSupportedLang(stored) ? stored : DEFAULT_LANG;
};

export const setLang = (l: string) => {
  safeSet(LANG_KEY, l);
  notifyLang();
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") message = data.detail;
      else if (typeof data?.message === "string") message = data.message;
    } catch {
      /* no json body */
    }
    if (res.status === 401) clearToken();
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function upload<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { method: "POST", headers, body: form });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") message = data.detail;
    } catch {
      /* no json body */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

/** POST JSON and return the raw response body as a Blob (audio, files). */
async function postBlob(path: string, body: unknown): Promise<Blob> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") message = data.detail;
    } catch {
      /* no json body */
    }
    if (res.status === 401) clearToken();
    throw new ApiError(res.status, message);
  }
  return await res.blob();
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
  upload,
  postBlob,
};
