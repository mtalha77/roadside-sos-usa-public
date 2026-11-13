# Design: calm under stress

People use this product on the side of a road, often at night, stressed, on a phone with one hand.
The interface should feel steady and quiet so the one thing that matters stands out.

## Principles

1. **One signal colour.** Safety amber (`primary` / `signal`) marks the single main action on a
   screen ("Get help now", "Accept quote") and genuine urgency. Nothing else is amber: not links,
   not decoration, not illustrations. If two things on a screen are amber, one is wrong.
2. **Deep ink neutrals** carry everything else: text, surfaces, borders, secondary actions.
3. **Status colours mean state**, never decoration: `success` (arrived, paid), `warning` (running
   late, low balance), `critical` (failed, cancelled, safety), `info` (neutral updates). Use the
   `-subtle` background with `-strong` text for badges and banners.
4. **Large, readable type.** Body is 17px on phones and 16px on desktop. Key numbers (price, ETA,
   countdown) use display sizes and `tabular-nums` so digits do not jump.
5. **Generous space on an 8-point rhythm** (Tailwind steps 2, 4, 6, 8, 12, 16).
6. **Short, purposeful motion**: 150 ms (feedback), 200 ms (most transitions), 250 ms (sheets,
   dialogs), `ease-standard` or `ease-emphasized` for entering, `ease-exit` for leaving. Never loop
   decorative motion; everything respects `prefers-reduced-motion`.
7. **Full dark mode.** Every colour is a token, so switching theme changes every surface. Raw colour
   values and Tailwind palette classes (`bg-white`, `text-gray-500`, `bg-amber-500`) fail a test.
8. **Honest content.** No stock photos, template gradients, generic hero art, fake numbers or reviews.

## Where things live

- Tokens: `packages/config/src/tokens.ts` (source of truth). After editing, run
  `pnpm --filter @rsos/config tokens:build` to regenerate `packages/config/tailwind/theme.css`.
- CI runs `tokens:check`: every foreground/background pair must meet WCAG 2.2 AA (4.5:1 text,
  3:1 for input borders and focus rings) in both themes, and the CSS must be up to date.
- Storybook → Foundations → Design tokens shows colours, contrast, type, space, radius, elevation, motion.
- Font: Geist (self-hosted through the `geist` package and `next/font`).

## Using the signal colour

| Situation                                 | Use                                                             |
| ----------------------------------------- | --------------------------------------------------------------- |
| The one main action on a screen           | `Button` default variant (`bg-primary text-primary-foreground`) |
| Countdown or "waiting for quotes" urgency | `text-signal-strong`, `bg-signal` for the ring                  |
| A second action on the same screen        | `secondary` or `outline` button, never amber                    |
| Errors and safety warnings                | `critical` tokens, not amber                                    |
| Links                                     | `text-foreground underline`, not amber                          |
