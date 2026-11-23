import { fileURLToPath } from "node:url";
import { nodeConfig } from "@rsos/testing/vitest/node";
import { mergeConfig } from "vitest/config";

// `server-only` throws outside React Server Components; tests replace it with an empty module.
export default mergeConfig(nodeConfig, {
  resolve: {
    alias: { "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)) },
  },
});
