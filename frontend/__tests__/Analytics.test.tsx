import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, get: (...args: unknown[]) => get(...args) }, getToken: () => "tok", getLang: () => "en" };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => "/analytics" }));

import AnalyticsPage from "@/app/analytics/page";

const DATA = {
  days: 7,
  totals: { amount: 5000, expenses: 800, net: 4200, hours: 30, net_per_hour: 140 },
  by_platform: [
    { platform: "Swiggy", amount: 3000, expenses: 400, net: 2600, hours: 18, net_per_hour: 144.4, entries: 4 },
    { platform: "Zomato", amount: 2000, expenses: 400, net: 1600, hours: 12, net_per_hour: 133.3, entries: 3 },
  ],
  by_day: [
    { date: "2026-10-11", net: 600, hours: 4 },
    { date: "2026-10-12", net: 900, hours: 6 },
  ],
  best_platform: "Swiggy",
  insight: "Swiggy pays you more per hour.",
};

describe("AnalyticsPage", () => {
  it("renders totals, per-platform rows and the insight from the API", async () => {
    get.mockResolvedValue(DATA);
    render(<AnalyticsPage />);
    expect(await screen.findByText("₹4,200")).toBeInTheDocument();
    expect(screen.getByText("30h")).toBeInTheDocument();
    expect(screen.getByText("₹140")).toBeInTheDocument();
    expect(screen.getByText("Swiggy pays you more per hour.")).toBeInTheDocument();
    expect(screen.getByText(/Best platform: Swiggy/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Day by day" })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/earnings/analytics?days=7");
  });

  it("shows the empty state when there is no data", async () => {
    get.mockResolvedValue({ ...DATA, by_platform: [], by_day: [], insight: "" });
    render(<AnalyticsPage />);
    expect(await screen.findByText(/No data yet/)).toBeInTheDocument();
  });
});
