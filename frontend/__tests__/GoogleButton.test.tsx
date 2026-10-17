import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { ...actual.api, get: (...args: unknown[]) => get(...args), post: (...args: unknown[]) => post(...args) },
    getLang: () => "en",
  };
});

import GoogleButton from "@/components/GoogleButton";

describe("GoogleButton", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it("renders a demo button when the backend allows demo sign-in and posts the demo credential", async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({ enabled: false, demo: true });
    const res = { token: "t", user: { id: 1, platforms: ["Zomato"], language: "en" } };
    post.mockResolvedValue(res);
    const onSignedIn = vi.fn();
    render(<GoogleButton onSignedIn={onSignedIn} />);

    const btn = await screen.findByRole("button", { name: /Continue with Google \(demo\)/ });
    await user.click(btn);
    expect(post).toHaveBeenCalledWith("/auth/google", { credential: "demo" });
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(res));
  });

  it("renders nothing when neither real nor demo sign-in is available", async () => {
    get.mockResolvedValue({ enabled: false, demo: false });
    const { container } = render(<GoogleButton onSignedIn={() => {}} />);
    await waitFor(() => expect(get).toHaveBeenCalledWith("/auth/google/config"));
    expect(container).toBeEmptyDOMElement();
  });
});
