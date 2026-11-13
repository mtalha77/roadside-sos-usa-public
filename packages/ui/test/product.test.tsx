import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BigToggle } from "../src/components/big-toggle";
import { CountdownRing } from "../src/components/countdown-ring";
import { UpdatedAgo } from "../src/components/live-dot";
import { interpolate, MapView } from "../src/components/map-view";
import { PriceTag } from "../src/components/price-tag";
import { QuoteCard } from "../src/components/quote-card";
import { ServiceTile } from "../src/components/service-tile";
import { REQUEST_STATUSES, StatusPill } from "../src/components/status-pill";
import { SwipeToConfirm } from "../src/components/swipe-to-confirm";
import { expectNoAxeViolations } from "./axe";

vi.mock("@googlemaps/js-api-loader", () => ({
  setOptions: vi.fn(),
  importLibrary: vi.fn(async () => ({
    Map: vi.fn(() => ({ setOptions: vi.fn(), panTo: vi.fn() })),
  })),
}));

describe("CountdownRing", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] }));
  afterEach(() => vi.useRealTimers());

  it("is correct after the tab was in the background (no ticks while hidden)", () => {
    const start = Date.now();
    render(<CountdownRing label="Time left" startsAt={start} endsAt={start + 180_000} />);
    expect(screen.getByRole("timer", { name: "Time left" })).toHaveTextContent("3:00");
    // Background tab: timers are throttled, so 95 seconds pass with no interval callbacks.
    vi.setSystemTime(start + 95_000);
    act(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByRole("timer")).toHaveTextContent("1:25");
  });

  it("calls onComplete once at zero", () => {
    const start = Date.now();
    const onComplete = vi.fn();
    render(
      <CountdownRing label="t" startsAt={start} endsAt={start + 2_000} onComplete={onComplete} />,
    );
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("UpdatedAgo", () => {
  it("counts from the timestamp, not from ticks", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    const at = Date.now();
    render(<UpdatedAgo at={at} />);
    expect(screen.getByText("Updated just now")).toBeInTheDocument();
    vi.setSystemTime(at + 42_000);
    act(() => window.dispatchEvent(new Event("focus")));
    expect(screen.getByText("Updated 42 seconds ago")).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("product components", () => {
  it("ServiceTile is one large pressable button", async () => {
    const onClick = vi.fn();
    render(
      <ServiceTile
        icon={<svg />}
        label="Flat tire"
        hint="Spare change"
        onClick={onClick}
        selected
      />,
    );
    const tile = screen.getByRole("button", { name: /Flat tire/ });
    expect(tile).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(tile);
    expect(onClick).toHaveBeenCalled();
  });

  it("StatusPill always shows a text label for every state", () => {
    render(
      <div>
        {REQUEST_STATUSES.map((s) => (
          <StatusPill key={s} status={s} />
        ))}
      </div>,
    );
    expect(screen.getByText("On the way")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("PriceTag formats whole cents", () => {
    render(<PriceTag cents={12850} />);
    expect(screen.getByText("$128.50")).toBeInTheDocument();
  });

  it("QuoteCard is a single choice button with an informative name; no fake rating for new providers", async () => {
    const onSelect = vi.fn();
    render(
      <QuoteCard
        onSelect={onSelect}
        quote={{
          id: "q",
          priceCents: 9500,
          etaMinutes: 12,
          tag: "fastest",
          provider: {
            name: "New Test Provider",
            rating: null,
            reviewCount: 0,
            insured: true,
            licensed: false,
          },
        }}
      />,
    );
    const card = screen.getByRole("button", { name: "Choose New Test Provider for $95.00" });
    expect(screen.getByText("New provider")).toBeInTheDocument();
    expect(screen.getByText("Fastest")).toBeInTheDocument();
    await userEvent.click(card);
    expect(onSelect).toHaveBeenCalled();
    await expectNoAxeViolations();
  });

  it("BigToggle is a switch", async () => {
    const onChange = vi.fn();
    render(<BigToggle online={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("SwipeToConfirm confirms with the keyboard", async () => {
    const onConfirm = vi.fn();
    render(<SwipeToConfirm label="Slide to accept" onConfirm={onConfirm} />);
    screen.getByRole("button", { name: /Slide to accept/ }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("MapView", () => {
  it("degrades to a static placeholder without a key, listing locations", async () => {
    render(
      <MapView
        label="Map"
        center={{ lat: 1, lng: 2 }}
        markers={[{ id: "d", kind: "driver", position: { lat: 1, lng: 2 }, label: "You are here" }]}
      />,
    );
    expect(screen.getByText(/Map unavailable/)).toBeInTheDocument();
    expect(screen.getByText("You are here")).toBeInTheDocument();
    await expectNoAxeViolations();
  });

  it("loads Google Maps with the key", async () => {
    const loader = await import("@googlemaps/js-api-loader");
    render(<MapView apiKey="test-key" label="Live map" center={{ lat: 1, lng: 2 }} />);
    expect(screen.getByRole("region", { name: "Live map" })).toBeInTheDocument();
    await vi.waitFor(() => expect(loader.importLibrary).toHaveBeenCalledWith("maps"));
    expect(loader.setOptions).toHaveBeenCalledWith({ key: "test-key", v: "weekly" });
  });

  it("interpolates marker movement smoothly", () => {
    expect(interpolate({ lat: 0, lng: 0 }, { lat: 10, lng: 20 }, 0.5)).toEqual({ lat: 5, lng: 10 });
    expect(interpolate({ lat: 0, lng: 0 }, { lat: 10, lng: 20 }, 2)).toEqual({ lat: 10, lng: 20 });
  });
});
