import { brand } from "@rsos/config/brand";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppPlaceholder } from "../src/components/app-placeholder";
import { Button } from "../src/components/button";

describe("Button", () => {
  it("renders with a 48px minimum touch target in every size", () => {
    for (const size of ["default", "lg", "icon"] as const) {
      const { unmount } = render(
        <Button size={size} aria-label={`button-${size}`}>
          x
        </Button>,
      );
      expect(screen.getByRole("button", { name: `button-${size}` })).toHaveClass("min-h-touch");
      unmount();
    }
  });

  it("renders a link when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/help">Help</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute("href", "/help");
  });
});

describe("AppPlaceholder", () => {
  it("shows the brand name from config as the page heading", () => {
    render(
      <AppPlaceholder
        appLabel="Public website"
        headline="Headline"
        body="Body"
        cta="Go"
        comingSoon="Coming soon"
        toggleThemeLabel="Toggle theme"
        skipToContentLabel="Skip to main content"
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(brand.name);
    expect(screen.getByRole("button", { name: "Toggle theme" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
