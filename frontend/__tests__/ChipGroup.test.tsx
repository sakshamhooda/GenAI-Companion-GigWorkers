import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ChipGroup } from "@/components/ui";

const OPTIONS = [
  { value: "Zomato", label: "Zomato" },
  { value: "Swiggy", label: "Swiggy" },
];

function Harness({ initial = [] as string[], addLabel }: { initial?: string[]; addLabel?: string }) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <>
      <ChipGroup id="p" label="Platforms" options={OPTIONS} value={value} onChange={setValue} addLabel={addLabel} addPlaceholder="Other" />
      <output data-testid="value">{value.join(",")}</output>
    </>
  );
}

describe("ChipGroup", () => {
  it("toggles chips on and off with aria-pressed", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const zomato = screen.getByRole("button", { name: /Zomato/ });
    expect(zomato).toHaveAttribute("aria-pressed", "false");

    await user.click(zomato);
    expect(zomato).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("value")).toHaveTextContent("Zomato");

    await user.click(screen.getByRole("button", { name: /Swiggy/ }));
    expect(screen.getByTestId("value")).toHaveTextContent("Zomato,Swiggy");

    await user.click(zomato);
    expect(zomato).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("value")).toHaveTextContent("Swiggy");
  });

  it("renders pre-selected custom values as chips", () => {
    render(<Harness initial={["Porter"]} />);
    expect(screen.getByRole("button", { name: /Porter/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("adds a custom chip from the add box with Enter and ignores duplicates", async () => {
    const user = userEvent.setup();
    render(<Harness addLabel="Add another" />);
    const box = screen.getByLabelText("Add another");
    await user.type(box, "Dunzo{Enter}");
    expect(screen.getByRole("button", { name: /Dunzo/ })).toHaveAttribute("aria-pressed", "true");
    expect(box).toHaveValue("");

    await user.type(box, "Dunzo{Enter}");
    expect(screen.getAllByRole("button", { name: /Dunzo/ })).toHaveLength(1);
    expect(screen.getByTestId("value")).toHaveTextContent("Dunzo");
  });

  it("adds a custom chip via the add button", async () => {
    const user = userEvent.setup();
    render(<Harness addLabel="Add another" />);
    await user.type(screen.getByLabelText("Add another"), "Shadowfax");
    await user.click(screen.getByRole("button", { name: "Add another" }));
    expect(screen.getByRole("button", { name: /Shadowfax/ })).toBeInTheDocument();
  });
});
