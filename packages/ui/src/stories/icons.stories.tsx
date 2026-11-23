import type { Meta, StoryObj } from "@storybook/react-vite";
import { Phone, Search, ShieldCheck } from "lucide-react";
import { Icon, serviceIcons, vehicleIcons } from "../components/icon";
import { illustrations } from "../illustrations";
import { State, States } from "./_helpers";

const meta = { title: "Foundations/Icons and illustrations" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function Grid({ items }: { items: [string, Parameters<typeof Icon>[0]["icon"]][] }) {
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {items.map(([name, glyph]) => (
        <li
          key={name}
          className="flex flex-col items-center gap-2 rounded-xl border bg-surface p-4 text-center"
        >
          <Icon icon={glyph} size="xl" />
          <code className="text-xs text-muted-foreground">{name}</code>
        </li>
      ))}
    </ul>
  );
}

export const Icons: Story = {
  render: () => (
    <States>
      <State label="Services (original, 24px grid, 2px stroke)">
        <Grid items={Object.entries(serviceIcons)} />
      </State>
      <State label="Vehicles (original)">
        <Grid items={Object.entries(vehicleIcons)} />
      </State>
      <State label="Lucide through the same Icon component">
        <Grid
          items={[
            ["phone", Phone],
            ["search", Search],
            ["insured", ShieldCheck],
          ]}
        />
      </State>
      <State label="Sizes sm, md, lg, xl">
        <Icon icon={serviceIcons.tow} size="sm" />
        <Icon icon={serviceIcons.tow} size="md" />
        <Icon icon={serviceIcons.tow} size="lg" />
        <Icon icon={serviceIcons.tow} size="xl" label="Tow truck" />
      </State>
    </States>
  ),
};

export const Illustrations: Story = {
  render: () => (
    <States>
      <State label="How it works and empty states (original line art, token colours)">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Object.entries(illustrations).map(([name, Art]) => (
            <li
              key={name}
              className="flex flex-col items-center gap-2 rounded-xl border bg-background p-4 text-muted-foreground"
            >
              <Art width={140} />
              <code className="text-xs">{name}</code>
            </li>
          ))}
        </ul>
      </State>
    </States>
  ),
};
