import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PinInput } from "@/components/ui";

describe("PinInput", () => {
  it("hides the PIN by default and reveals it on toggle", async () => {
    const user = userEvent.setup();
    render(<PinInput id="pin" value="1234" onChange={() => {}} showLabel="Show PIN" hideLabel="Hide PIN" />);

    const input = document.getElementById("pin") as HTMLInputElement;
    expect(input.type).toBe("password");

    const toggle = screen.getByRole("button", { name: "Show PIN" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);

    expect(input.type).toBe("text");
    expect(screen.getByRole("button", { name: "Hide PIN" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Hide PIN" }));
    expect(input.type).toBe("password");
  });

  it("keeps the value digits only and at most four characters", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PinInput id="pin" value="" onChange={onChange} showLabel="Show PIN" hideLabel="Hide PIN" />);

    const input = document.getElementById("pin") as HTMLInputElement;
    await user.type(input, "1a");
    expect(onChange).toHaveBeenLastCalledWith("1");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("maxlength", "4");
  });
});
