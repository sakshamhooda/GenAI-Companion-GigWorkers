import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, clearToken, getLang, getToken, setLang, setToken } from "@/lib/api";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("api client", () => {
  beforeEach(() => clearToken());
  afterEach(() => vi.unstubAllGlobals());

  it("attaches the bearer token and JSON headers", async () => {
    setToken("tok123");
    const fetchMock = mockFetch(200, { id: 1 });
    await expect(api.get<{ id: number }>("/me")).resolves.toEqual({ id: 1 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/me$/);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok123");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init.method).toBe("GET");
  });

  it("serialises the body on POST and sends no Authorization without a token", async () => {
    const fetchMock = mockFetch(201, { ok: true });
    await api.post("/auth/login", { phone: "6000000000", pin: "0000" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ phone: "6000000000", pin: "0000" });
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("throws ApiError with the server's detail on failure", async () => {
    mockFetch(409, { detail: "Phone already registered" });
    await expect(api.post("/auth/register", {})).rejects.toMatchObject({
      status: 409,
      message: "Phone already registered",
    });
    await expect(api.post("/auth/register", {})).rejects.toBeInstanceOf(ApiError);
  });

  it("clears the stored token on 401", async () => {
    setToken("expired");
    mockFetch(401, { detail: "Invalid or expired token" });
    await expect(api.get("/me")).rejects.toMatchObject({ status: 401 });
    expect(getToken()).toBeNull();
  });

  it("upload posts FormData without a JSON content type", async () => {
    setToken("tok");
    const fetchMock = mockFetch(200, { transcript: "hi" });
    const form = new FormData();
    form.append("file", new Blob(["x"], { type: "audio/webm" }), "a.webm");
    await expect(api.upload("/voice/transcribe", form)).resolves.toEqual({ transcript: "hi" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("falls back to the default language for unsupported stored codes", () => {
    setLang("ta");
    expect(getLang()).toBe("ta");
    setLang("klingon");
    expect(getLang()).toBe("hi");
  });
});
