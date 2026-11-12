import nextVitals from "eslint-config-next/core-web-vitals";
import { baseConfig } from "./base.mjs";

/** ESLint config for Next.js apps and React packages (includes jsx-a11y and react-hooks rules). */
export const nextConfig = [
  ...nextVitals,
  ...baseConfig,
  {
    rules: {
      // Accessibility is a release requirement (WCAG 2.2 AA): escalate a11y warnings to errors.
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
    },
  },
];

/** Same rules for React libraries that are not a Next app. */
export const reactLibraryConfig = [
  ...nextConfig,
  { rules: { "@next/next/no-html-link-for-pages": "off" } },
];
