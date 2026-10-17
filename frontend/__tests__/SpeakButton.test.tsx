import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postBlob = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { ...actual.api, postBlob: (...args: unknown[]) => postBlob(...args) },
    getLang: () => "en",
  };
});

import SpeakButton from "@/components/SpeakButton";

class FakeAudio {
  static instances: FakeAudio[] = [];
  src: string;
  currentTime = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }
}

describe("SpeakButton", () => {
  beforeEach(() => {
    postBlob.mockReset();
    FakeAudio.instances = [];
    vi.stubGlobal("Audio", FakeAudio);
    URL.createObjectURL = vi.fn(() => "blob:fake");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches audio for the text in the given language and toggles pressed state", async () => {
    const user = userEvent.setup();
    postBlob.mockResolvedValue(new Blob(["x"], { type: "audio/mpeg" }));
    render(<SpeakButton text="Namaste" lang="hi" />);

    const btn = await screen.findByRole("button", { name: "Listen" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await user.click(btn);

    expect(postBlob).toHaveBeenCalledWith("/voice/speak", { text: "Namaste", language: "hi" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Stop" })).toHaveAttribute("aria-pressed", "true"));
    expect(FakeAudio.instances[0].play).toHaveBeenCalled();
  });

  it("stops playback on the second click", async () => {
    const user = userEvent.setup();
    postBlob.mockResolvedValue(new Blob(["x"], { type: "audio/mpeg" }));
    render(<SpeakButton text="Namaste" lang="hi" />);

    await user.click(await screen.findByRole("button", { name: "Listen" }));
    const stopBtn = await screen.findByRole("button", { name: "Stop" });
    await user.click(stopBtn);

    expect(FakeAudio.instances[0].pause).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Listen" })).toHaveAttribute("aria-pressed", "false"));
  });

  it("shows an unavailable note on 503", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("@/lib/api");
    postBlob.mockRejectedValue(new ApiError(503, "busy"));
    render(<SpeakButton text="Namaste" lang="hi" />);

    await user.click(await screen.findByRole("button", { name: "Listen" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Audio unavailable right now");
  });
});
