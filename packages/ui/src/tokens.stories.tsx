import { contrastRatio } from "@rsos/config/color";
import { contrastPairs, motion, radius, shadows, themes, typeScale } from "@rsos/config/tokens";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Foundations/Design tokens",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 p-6">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Every colour token, rendered from CSS variables so the theme toolbar switches all of them. */
export const Colours: Story = {
  render: () => (
    <Section title="Colours">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Object.keys(themes.light).map((name) => (
          <div key={name} className="overflow-hidden rounded-lg border">
            <div className="h-16" style={{ background: `var(--${name})` }} />
            <div className="bg-surface p-2 text-sm">
              <code>{name}</code>
            </div>
          </div>
        ))}
      </div>
    </Section>
  ),
};

/** WCAG 2.2 AA contrast for every pair the UI uses, in both themes (same check as CI). */
export const Contrast: Story = {
  render: () => (
    <Section title="Contrast (WCAG 2.2 AA)">
      <table className="w-full text-left text-sm tabular-nums">
        <thead>
          <tr className="border-b">
            <th className="py-2">Pair</th>
            <th>Minimum</th>
            <th>Light</th>
            <th>Dark</th>
          </tr>
        </thead>
        <tbody>
          {contrastPairs.map(({ fg, bg, min }) => (
            <tr key={`${fg}-${bg}`} className="border-b">
              <td className="py-2">
                {min >= 4.5 ? (
                  <span
                    className="rounded px-2 py-1"
                    style={{ color: `var(--${fg})`, background: `var(--${bg})` }}
                  >
                    {fg} on {bg}
                  </span>
                ) : (
                  // Non-text pairs (input borders, focus rings): a border swatch, labelled in normal text.
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="inline-block size-6 rounded border-2"
                      style={{ borderColor: `var(--${fg})`, background: `var(--${bg})` }}
                    />
                    {fg} on {bg} (non-text)
                  </span>
                )}
              </td>
              <td>{min}:1</td>
              <td>{contrastRatio(themes.light[fg]!, themes.light[bg]!).toFixed(2)}:1</td>
              <td>{contrastRatio(themes.dark[fg]!, themes.dark[bg]!).toFixed(2)}:1</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  ),
};

export const Typography: Story = {
  render: () => (
    <Section title="Type scale (Geist; body 17px on phones, 16px on desktop)">
      <div className="space-y-3">
        {Object.entries(typeScale).map(([name, [size, lineHeight]]) => (
          <div key={name} className="flex items-baseline gap-6 border-b pb-3">
            <code className="w-28 shrink-0 text-sm text-muted-foreground">
              {name} {size}
            </code>
            <span style={{ fontSize: size, lineHeight }}>Help is on the way</span>
          </div>
        ))}
        <p className="text-3xl font-semibold tabular-nums">$128.50 · 12 min · 4.8</p>
        <p className="text-sm text-muted-foreground">
          Prices, ETAs and money always use tabular numbers (`tabular-nums`).
        </p>
      </div>
    </Section>
  ),
};

export const SpaceRadiusElevation: Story = {
  name: "Space, radius, elevation",
  render: () => (
    <Section title="Space (8-point), radius, elevation">
      <div className="flex flex-wrap items-end gap-4">
        {[2, 4, 6, 8, 12, 16].map((step) => (
          <div key={step} className="text-center text-sm">
            <div className="bg-signal" style={{ width: step * 4, height: step * 4 }} />
            <code>{step * 4}px</code>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        {Object.entries(radius).map(([name, value]) => (
          <div
            key={name}
            className="flex size-24 items-center justify-center border bg-surface text-sm"
            style={{ borderRadius: value }}
          >
            {name}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-6">
        {Object.entries(shadows).map(([name, value]) => (
          <div
            key={name}
            className="flex size-28 items-center justify-center rounded-lg bg-surface text-sm"
            style={{ boxShadow: value }}
          >
            shadow-{name}
          </div>
        ))}
      </div>
    </Section>
  ),
};

export const Motion: Story = {
  render: () => (
    <Section title="Motion (respects reduced motion)">
      <ul className="space-y-2 text-sm">
        {Object.entries(motion.duration).map(([k, v]) => (
          <li key={k}>
            <code>duration-{k}</code>: {v}
          </li>
        ))}
        {Object.entries(motion.ease).map(([k, v]) => (
          <li key={k}>
            <code>ease-{k}</code>: {v}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="min-h-touch rounded-lg bg-primary px-5 font-semibold text-primary-foreground transition-transform duration-200 ease-emphasized hover:scale-105"
      >
        Hover me (200 ms, emphasized)
      </button>
    </Section>
  ),
};
