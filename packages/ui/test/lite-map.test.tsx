import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiteMap } from "../src/components/lite-map";

const from = { lat: 29.5, lng: -98.6 };
const to = { lat: 29.4, lng: -98.5 };

// Owner decision 4: one truck on the map. The decorative truck that loops along the route is only
// drawn when no live truck position is shown (it also kept WebKit without a GPU repainting).
describe("LiteMap", () => {
  it("animates a truck along a route when there is no live truck", () => {
    const { container } = render(
      <LiteMap
        label="Map"
        route={{ from, to }}
        points={[{ id: "me", kind: "request", ...to, label: "Me" }]}
      />,
    );
    expect(container.querySelector("animateMotion")).not.toBeNull();
  });

  it("shows only the live truck when its position is known", () => {
    const { container } = render(
      <LiteMap
        label="Map"
        route={{ from, to }}
        points={[
          { id: "me", kind: "request", ...to, label: "Me" },
          { id: "truck", kind: "truck", ...from, label: "Provider" },
        ]}
      />,
    );
    expect(container.querySelector("animateMotion")).toBeNull();
  });
});
