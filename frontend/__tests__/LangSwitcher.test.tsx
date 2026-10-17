import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const put = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, put: (...args: unknown[]) => put(...args) } };
});

import LangSwitcher from "@/components/LangSwitcher";
import { getLang, setToken } from "@/lib/api";

describe("LangSwitcher", () => {
  beforeEach(() => {
    put.mockReset();
    put.mockResolvedValue({});
  });

  it("changes the stored language, html lang/dir, and saves to the profile when logged in", async () => {
    const user = userEvent.setup();
    setToken("tok");
    render(<LangSwitcher />);
    await user.selectOptions(screen.getByRole("combobox"), "ur");
    expect(getLang()).toBe("ur");
    expect(document.documentElement.lang).toBe("ur");
    expect(document.documentElement.dir).toBe("rtl");
    expect(put).toHaveBeenCalledWith("/me", { language: "ur" });
  });

  it("does not call the API when logged out", async () => {
    const user = userEvent.setup();
    render(<LangSwitcher />);
    await user.selectOptions(screen.getByRole("combobox"), "ta");
    expect(getLang()).toBe("ta");
    expect(put).not.toHaveBeenCalled();
  });
});
