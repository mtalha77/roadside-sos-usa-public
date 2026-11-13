import nextVitals from "eslint-config-next/core-web-vitals";
import { baseConfig, brandSelectors } from "./base.mjs";

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

/**
 * No hardcoded user-facing text (RSOS-015): JSX text and literal aria-label, placeholder, alt and
 * title values must come from message files (apps) or label props (packages/ui). Punctuation and
 * symbols in the allow list are fine. Stories and tests are exempt.
 */
const userFacingAttributes = "/^(aria-label|aria-description|placeholder|alt|title)$/";
export const noHardcodedText = {
  files: ["src/**/*.tsx"],
  ignores: ["src/**/*.stories.tsx", "src/stories/**", "src/**/*.test.tsx"],
  rules: {
    "react/jsx-no-literals": [
      "error",
      {
        noStrings: true,
        ignoreProps: true,
        allowedStrings: [
          "·",
          "©",
          "—",
          "–",
          "*",
          "$",
          "+1",
          "(",
          ")",
          "/",
          ":",
          "|",
          "…",
          "%",
          "×",
        ],
      },
    ],
    "no-restricted-syntax": [
      "error",
      ...brandSelectors,
      {
        selector: `JSXAttribute[name.name=${userFacingAttributes}] > Literal`,
        message:
          "User-facing text must come from the message files (useTranslations) or a label prop.",
      },
    ],
  },
};
nextConfig.push(noHardcodedText);

/** Same rules for React libraries that are not a Next app. */
export const reactLibraryConfig = [
  ...nextConfig,
  { rules: { "@next/next/no-html-link-for-pages": "off" } },
];
