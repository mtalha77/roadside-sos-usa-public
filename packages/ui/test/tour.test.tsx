import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tour } from "../src/components/tour";

const labels = {
  back: "Back",
  next: "Next",
  done: "Done",
  skip: "Skip tour",
  hide: "Don't show again",
  step: "Step {n} of {total}",
};
const steps = [
  { title: "First", body: "One sentence." },
  { title: "Second", body: "Another sentence." },
];

describe("Tour (RSOS-105)", () => {
  it("is a modal dialog that moves with Next and Back and finishes with Done", () => {
    const onEnd = vi.fn();
    render(<Tour steps={steps} open labels={labels} onEnd={onEnd} />);
    expect(screen.getByRole("dialog", { name: "First" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog", { name: "Second" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("dialog", { name: "First" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onEnd).toHaveBeenCalledWith("done", 1);
  });

  it("skips with the button or Escape, and hides for good with Don't show again", () => {
    const onEnd = vi.fn();
    const { rerender } = render(<Tour steps={steps} open labels={labels} onEnd={onEnd} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onEnd).toHaveBeenLastCalledWith("skipped", 0);
    fireEvent.click(screen.getByRole("button", { name: "Skip tour" }));
    expect(onEnd).toHaveBeenLastCalledWith("skipped", 0);
    fireEvent.click(screen.getByRole("button", { name: "Don't show again" }));
    expect(onEnd).toHaveBeenLastCalledWith("hidden", 0);
    rerender(<Tour steps={steps} open={false} labels={labels} onEnd={onEnd} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
