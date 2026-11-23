import { defineConfig } from "vitest/config";

// Own config (not @rsos/testing) because @rsos/testing depends on @rsos/core.
// Gate 1: at least 80% coverage on shared business logic.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
