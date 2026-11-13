// Generates tailwind/theme.css from src/tokens.ts.
// Usage: node scripts/build-tokens.ts          (write)
//        node scripts/build-tokens.ts --check  (CI: fail if theme.css is out of date)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { motion, radius, shadows, themes, typeScale } from "../src/tokens.ts";

const out = fileURLToPath(new URL("../tailwind/theme.css", import.meta.url));
const vars = (tokens: Record<string, string>, indent = "  ") =>
  Object.entries(tokens)
    .map(([k, v]) => `${indent}--${k}: ${v};`)
    .join("\n");

const css = `/*
 * GENERATED from packages/config/src/tokens.ts by scripts/build-tokens.ts. Do not edit by hand.
 * Import after \`@import "tailwindcss";\` in each app's globals.css.
 * Rules (DESIGN.md): the signal colour (amber) is only for the primary action and urgency; every
 * colour is a token, so switching theme changes every surface.
 */

/* Dark mode follows the \`.dark\` class set by next-themes on <html>. */
@custom-variant dark (&:where(.dark, .dark *));

:root {
${vars(themes.light)}
  --radius: ${radius.lg};
  --duration-fast: ${motion.duration.fast};
  --duration-base: ${motion.duration.base};
  --duration-slow: ${motion.duration.slow};
  color-scheme: light;
}

.dark {
${vars(themes.dark)}
  color-scheme: dark;
}

@theme inline {
${Object.keys(themes.light)
  .map((k) => `  --color-${k}: var(--${k});`)
  .join("\n")}
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, "SF Mono", Menlo, monospace;
}

@theme {
${Object.entries(typeScale)
  .map(([k, [size, lh]]) => `  --text-${k}: ${size};\n  --text-${k}--line-height: ${lh};`)
  .join("\n")}
${Object.entries(radius)
  .map(([k, v]) => `  --radius-${k}: ${v};`)
  .join("\n")}
${Object.entries(shadows)
  .map(([k, v]) => `  --shadow-${k}: ${v};`)
  .join("\n")}
${Object.entries(motion.ease)
  .map(([k, v]) => `  --ease-${k}: ${v};`)
  .join("\n")}
  /* Minimum touch target: 48px. Use \`min-h-touch min-w-touch\` on anything tappable. */
  --spacing-touch: 3rem;
  --spacing-13: 3.25rem;
  /* Enter animations (reduced motion collapses them, see base layer). */
  --animate-fade-in: fade-in var(--duration-base) var(--ease-standard);
  --animate-scale-in: scale-in var(--duration-slow) var(--ease-emphasized);
  --animate-slide-in-right: slide-in-right var(--duration-slow) var(--ease-emphasized);
  --animate-slide-up: slide-up var(--duration-slow) var(--ease-emphasized);
  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
  @keyframes scale-in {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
  }
  @keyframes slide-in-right {
    from {
      transform: translateX(100%);
    }
  }
  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateY(0.5rem);
    }
  }
}

@layer base {
  * {
    @apply border-border;
  }
  html {
    -webkit-text-size-adjust: 100%;
  }
  body {
    @apply bg-background font-sans text-foreground antialiased;
    font-size: var(--text-body);
    line-height: var(--text-body--line-height);
  }
  @media (min-width: 768px) {
    body {
      font-size: var(--text-base);
      line-height: var(--text-base--line-height);
    }
  }
  :focus-visible {
    @apply outline-2 outline-offset-2 outline-ring;
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
`;

if (process.argv.includes("--check")) {
  const current = readFileSync(out, "utf8");
  if (current !== css) {
    console.error(
      "tailwind/theme.css is out of date. Run: pnpm --filter @rsos/config tokens:build",
    );
    process.exit(1);
  }
  console.log("theme.css is up to date.");
} else {
  writeFileSync(out, css);
  console.log(`Wrote ${out}`);
}
