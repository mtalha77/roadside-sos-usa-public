import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/** Shared Vitest config for React code (jsdom, Testing Library, jest-dom matchers). */
export const reactConfig = defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["@rsos/testing/setup/react"],
    include: ["test/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    coverage: { provider: "v8", reporter: ["text", "json-summary"], include: ["src/**"] },
  },
});
