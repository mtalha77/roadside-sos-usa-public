import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("rename-ready", () => {
  it("changing the domain variable updates every URL, email and the metadata title source", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_DOMAIN", "new-brand.test");
    vi.resetModules();
    const { brand } = await import("../src/brand");
    expect(brand.domain).toBe("new-brand.test");
    expect(brand.urls.web).toBe("https://new-brand.test");
    expect(brand.urls.provider).toBe("https://pro.new-brand.test");
    expect(brand.urls.admin).toBe("https://admin.new-brand.test");
    expect(brand.emails.support).toBe("support@new-brand.test");

    const { buildMetadata } = await import("../src/metadata");
    const meta = buildMetadata({ app: "web", title: "Help", env: {} });
    expect(meta.title).toEqual({ default: `Help | ${brand.name}`, template: `%s | ${brand.name}` });
    expect(meta.openGraph?.siteName).toBe(brand.name);
  });

  it("non-production metadata is never indexed", async () => {
    const { buildMetadata } = await import("../src/metadata");
    expect(buildMetadata({ app: "web", env: { NEXT_PUBLIC_SITE_ENV: "staging" } }).robots).toEqual({
      index: false,
      follow: false,
    });
    expect(
      buildMetadata({ app: "web", env: { NEXT_PUBLIC_SITE_ENV: "production" } }).robots,
    ).toEqual({
      index: true,
      follow: true,
    });
  });
});
