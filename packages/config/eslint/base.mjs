import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Blocks hardcoded brand names and domains outside packages/config/src/brand.ts.
 * Import `brand` from "@rsos/config/brand" instead.
 */
const BRAND_PATTERN = "/fixallcontractors|roadside\\s*sos/i";
export const brandSelectors = [
  {
    selector: `Literal[value=${BRAND_PATTERN}]`,
    message: "Do not hardcode the brand name or domain. Import `brand` from @rsos/config/brand.",
  },
  {
    selector: `TemplateElement[value.raw=${BRAND_PATTERN}]`,
    message: "Do not hardcode the brand name or domain. Import `brand` from @rsos/config/brand.",
  },
  {
    selector: `JSXText[value=${BRAND_PATTERN}]`,
    message: "Do not hardcode the brand name or domain. Import `brand` from @rsos/config/brand.",
  },
];
export const noHardcodedBrand = { rules: { "no-restricted-syntax": ["error", ...brandSelectors] } };

export const baseConfig = [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/dist/**",
      "**/coverage/**",
      "**/storybook-static/**",
      "**/next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  noHardcodedBrand,
  prettier,
];
