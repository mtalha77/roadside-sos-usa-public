import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests only; Playwright specs live in tests/e2e.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["test/**/*.test.{ts,tsx}"] },
});
