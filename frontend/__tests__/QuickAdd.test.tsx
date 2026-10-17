import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, post: (...args: unknown[]) => post(...args) }, getLang: () => "en" };
});
vi.mock("@/components/MicButton", () => ({ default: () => null }));

import QuickAdd from "@/components/QuickAdd";

const PARSED = { amount: 850, expenses: 120, platform: "Zomato", date: "2026-10-17", note: "" };

describe("QuickAdd", () => {
  beforeEach(() => post.mockReset());

  it("parses the text, lets the worker edit, then saves and resets", async () => {
    const user = userEvent.setup();
    const onAdded = vi.fn();
    post.mockResolvedValueOnce(PARSED).mockResolvedValueOnce({ id: 1, ...PARSED });
    render(<QuickAdd onAdded={onAdded} />);

    const addButton = screen.getByRole("button", { name: "Add" });
    expect(addButton).toBeDisabled();
    await user.type(screen.getByLabelText(/earnings/i), "aaj 850 kamaye, 120 petrol");
    await user.click(addButton);

    expect(post).toHaveBeenCalledWith("/earnings/parse", { text: "aaj 850 kamaye, 120 petrol" });
    const amount = await screen.findByLabelText(/Amount/);
    expect(amount).toHaveValue(850);

    await user.clear(amount);
    await user.type(amount, "900");
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenLastCalledWith("/earnings", { ...PARSED, amount: 900 });
    expect(screen.getByLabelText(/earnings/i)).toHaveValue("");
  });

  it("omits the platform when the parser returned none", async () => {
    const user = userEvent.setup();
    post.mockResolvedValueOnce({ ...PARSED, platform: null }).mockResolvedValueOnce({ id: 2 });
    render(<QuickAdd onAdded={() => {}} />);
    await user.type(screen.getByLabelText(/earnings/i), "700");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByLabelText(/Amount/);
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    const body = post.mock.calls[1][1] as Record<string, unknown>;
    expect(body).not.toHaveProperty("platform");
  });

  it("shows the server error and keeps the form", async () => {
    const user = userEvent.setup();
    post.mockRejectedValueOnce(new Error("Model unavailable"));
    render(<QuickAdd onAdded={() => {}} />);
    await user.type(screen.getByLabelText(/earnings/i), "700");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Model unavailable");
    expect(screen.getByLabelText(/earnings/i)).toHaveValue("700");
  });
});
