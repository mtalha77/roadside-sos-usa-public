import { fileURLToPath } from "node:url";
import { nodeConfig } from "@rsos/testing/vitest/node";
import { mergeConfig } from "vitest/config";

// Gate 1: at least 80% coverage. `server-only` throws outside React Server Components, so tests
// replace it with an empty module (the real guard is checked in test/service-role.test.ts).
export default mergeConfig(nodeConfig, {
  resolve: {
    alias: { "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)) },
  },
  test: {
    coverage: {
      exclude: ["src/database.types.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
