import { describe, expect, it } from "vitest";
import { DEFAULT_LANG, LANGUAGES, RTL_LANGS, SUPPORTED_LANGS, isSupportedLang, t } from "@/lib/i18n";

describe("i18n", () => {
  const en = t("en") as unknown as Record<string, unknown>;

  /** Every leaf in `reference` must exist in `actual` as a non-empty string (nested objects recurse). */
  function expectComplete(actual: Record<string, unknown>, reference: Record<string, unknown>, path: string) {
    for (const [key, refValue] of Object.entries(reference)) {
      const value = actual[key];
      const label = `${path}.${key}`;
      if (refValue && typeof refValue === "object") {
        expect(value, label).toBeTypeOf("object");
        expectComplete(value as Record<string, unknown>, refValue as Record<string, unknown>, label);
      } else {
        expect(value, label).toBeTypeOf("string");
        expect((value as string).trim().length, label).toBeGreaterThan(0);
      }
    }
  }

  it("lists 13 languages with native names and Sarvam codes", () => {
    expect(LANGUAGES).toHaveLength(13);
    for (const l of LANGUAGES) {
      expect(l.native.length).toBeGreaterThan(0);
      expect(l.sarvam).toBe(`${l.code}-IN`);
    }
    expect(SUPPORTED_LANGS).toContain(DEFAULT_LANG);
    expect(RTL_LANGS).toEqual(["ur"]);
  });

  it.each(SUPPORTED_LANGS)("%s has every string, none empty", (code) => {
    expectComplete(t(code) as unknown as Record<string, unknown>, en, code);
  });

  it("falls back to the default language for unknown codes", () => {
    expect(t("zz")).toEqual(t(DEFAULT_LANG));
    expect(isSupportedLang("zz")).toBe(false);
    expect(isSupportedLang(null)).toBe(false);
    expect(isSupportedLang("ta")).toBe(true);
  });

  it("uses native scripts, not transliterations, for the home tab", () => {
    expect(t("hi").home).toMatch(/[ऀ-ॿ]/);
    expect(t("ta").home).toMatch(/[஀-௿]/);
    expect(t("ur").home).toMatch(/[؀-ۿ]/);
  });
});
