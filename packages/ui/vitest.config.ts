import { reactConfig } from "@rsos/testing/vitest/react";
import { mergeConfig } from "vitest/config";

export default mergeConfig(reactConfig, {
  test: { setupFiles: ["./test/setup-dom.ts"], testTimeout: 15_000 },
});
