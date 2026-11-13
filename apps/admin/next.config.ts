import { securityHeaders } from "@rsos/config/security";
import { isIndexable, validateAppEnv } from "@rsos/config/site";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Fails the Vercel build if a required variable is missing (names only, never values).
validateAppEnv();

const APP = "admin" as const;
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ["@rsos/config", "@rsos/core", "@rsos/db", "@rsos/i18n", "@rsos/ui"],
  async headers() {
    const headers = securityHeaders(APP);
    // Staging, previews, the provider portal and the admin dashboard are never indexed.
    if (!isIndexable(APP)) headers.push({ key: "X-Robots-Tag", value: "noindex, nofollow" });
    return [{ source: "/:path*", headers }];
  },
};

export default withNextIntl(nextConfig);
