import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { Truck } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Icon, serviceIcons, vehicleIcons } from "../src/components/icon";
import { illustrations } from "../src/illustrations";

const ROOT = join(__dirname, "../../..");

describe("original icons share one grid and stroke", () => {
  const all = { ...serviceIcons, ...vehicleIcons };
  it.each(Object.entries(all))(
    "%s: 24x24, 2px round stroke, no fill, currentColor",
    (_name, Glyph) => {
      const svg = renderToStaticMarkup(<Glyph />);
      expect(svg).toContain('viewBox="0 0 24 24"');
      expect(svg).toContain('stroke-width="2"');
      expect(svg).toContain('stroke-linecap="round"');
      expect(svg).toContain('stroke-linejoin="round"');
      expect(svg).toContain('fill="none"');
      expect(svg).toContain('stroke="currentColor"');
      // Only geometry inside: no raster images, no fixed colours.
      expect(svg).not.toMatch(/<image|#[0-9a-f]{3,6}|rgb\(/i);
    },
  );

  it("covers the 6 services and 6 vehicle types", () => {
    expect(Object.keys(serviceIcons)).toEqual([
      "flat-tire",
      "wont-start",
      "locked-out",
      "out-of-gas",
      "tow",
      "winch-out",
    ]);
    expect(Object.keys(vehicleIcons)).toEqual(["car", "suv", "pickup", "motorcycle", "van", "rv"]);
  });

  it("Icon hides decorative icons and labels meaningful ones (Lucide and ours)", () => {
    const { container } = render(
      <>
        <Icon icon={Truck} />
        <Icon icon={serviceIcons.tow} label="Tow truck" />
      </>,
    );
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("img", { name: "Tow truck" })).toBeInTheDocument();
  });
});

describe("illustrations", () => {
  it.each(Object.entries(illustrations))(
    "%s uses the line style and only token colours",
    (_name, Art) => {
      const svg = renderToStaticMarkup(<Art />);
      expect(svg).toContain('viewBox="0 0 160 120"');
      expect(svg).toContain('stroke="currentColor"');
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(|<image/i);
    },
  );
});

describe("no third-party illustrations or stock images", () => {
  it("has no raster images in the repository", () => {
    const files = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n");
    expect(files.filter((f) => /\.(png|jpe?g|gif|webp|avif|bmp|tiff?)$/i.test(f))).toEqual([]);
  });

  it("depends on no illustration or stock packs", () => {
    const lock = readFileSync(join(ROOT, "pnpm-lock.yaml"), "utf8");
    for (const pack of [
      "undraw",
      "humaaans",
      "storyset",
      "open-peeps",
      "blush",
      "lottie",
      "unsplash",
      "pexels",
      "shutterstock",
    ]) {
      expect(lock.toLowerCase()).not.toContain(pack);
    }
  });
});
