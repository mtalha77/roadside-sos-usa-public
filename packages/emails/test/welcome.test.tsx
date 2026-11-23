import { brand } from "@rsos/config/brand";
import { describe, expect, it } from "vitest";
import { render, WelcomeEmail } from "../src";

describe("WelcomeEmail", () => {
  it("renders the brand name and support email from config", async () => {
    const html = await render(<WelcomeEmail firstName="Alex" />);
    expect(html).toContain(brand.name);
    expect(html).toContain(brand.emails.support);
    expect(html).toContain("Alex");
  });
});

describe("WelcomeEmail in Spanish", () => {
  it("renders from the Spanish message file", async () => {
    const html = await render(<WelcomeEmail firstName="Ana" locale="es" />);
    expect(html).toContain("Bienvenido");
    expect(html).toContain('lang="es"');
  });
});
