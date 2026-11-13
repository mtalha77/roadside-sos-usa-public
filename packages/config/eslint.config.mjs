import { baseConfig } from "./eslint/base.mjs";

export default [
  ...baseConfig,
  {
    // The brand file is the one place the brand name and domain may be written (base.mjs holds the rule pattern).
    files: ["src/brand.ts", "eslint/base.mjs", "test/brand-guard.test.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
];
