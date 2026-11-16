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

## Banned

Self-review every new screen and component against this list before opening a pull request.

- **Stacked shadows on rounded boxes.** A card is a border on `bg-card`; no `shadow-*` on a
  rounded box, and never a box with a shadow inside another box with a shadow.
- **More than one amber element** on a screen (see "Using the signal colour"). Per-item actions in
  a list (each quote's "Choose") are `outline`; the single main action is the only amber one.
- **Raw colours and palette classes** (`#hex`, `rgb()`, `bg-white`, `text-gray-500`): tokens only.
- **Gradients, glows, glass and blur** as decoration.
- **Stock photos, clip art and AI-style art.** Illustrations are our own flat line art in
  `@rsos/ui/illustrations`; provider logos are `ProviderLogo` monograms in the muted `mark-*`
  palette.
- **Real company names or look-alike brands** in demo data, fixtures, stories or tests. Demo
  providers are fictional and end in "(demo)".
- **Fake numbers outside demo mode.** Ratings, reviews, counts and ETAs shown to real users come
  from real data; demo data is labelled as demo.
- **Meaning by colour alone.** Status and tags always carry text.
- **Tap targets under 48 px** (`min-h-touch`, `min-w-touch`), and nested interactive elements
  (a button inside a button): extra controls sit outside the card's main button.
- **Inline user-facing strings.** Text goes in `packages/i18n/messages/{en,es}.json`.
- **Looping or decorative motion**, and any motion that ignores `prefers-reduced-motion`.

## Provider logos

Every provider shown to drivers, providers or staff uses `ProviderLogo`: a two-letter monogram in a
circle, shield, hexagon or rounded square, filled with one of eight muted `mark-*` tokens
(`mark-foreground` text passes 4.5:1 on each, in both themes). Use 44 to 56 px on cards and
headers, 20 to 32 px in lists and tables.

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
