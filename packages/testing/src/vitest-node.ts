import { defineConfig } from "vitest/config";

/** Shared Vitest config for Node packages: `export default nodeConfig` or merge it. */
export const nodeConfig = defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    coverage: { provider: "v8", reporter: ["text", "json-summary"], include: ["src/**"] },
  },
});
