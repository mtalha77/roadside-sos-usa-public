import type { Meta, StoryObj } from "@storybook/react-vite";
import counties from "../../../../supabase/data/census-counties-2024-500k.geojson?raw";
import markets from "../../../../supabase/data/markets.json";
import { type BoundaryFeature, BoundaryPreview } from "../components/boundary-preview";
import { State, States } from "./_helpers";

const meta = { title: "Product/Market boundaries" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const features = (
  JSON.parse(counties) as { features: (BoundaryFeature & { properties: { GEOID: string } })[] }
).features;

/** The seeded markets' boundaries (US Census counties) with each market's centre point. */
export const SeededMarkets: Story = {
  render: () => (
    <States>
      <State label="Seeded markets (from supabase/data, the same data as the reference migration)">
        <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {markets.markets.map((m) => (
            <BoundaryPreview
              key={m.slug}
              label={`${m.name}, ${m.stateCode} (${m.status}): ${m.counties.length} ${m.counties.length === 1 ? "county" : "counties"}`}
              features={features.filter((f) => m.counties.includes(f.properties.GEOID))}
              points={[{ lat: m.center[0]!, lng: m.center[1]!, label: `${m.name} centre` }]}
            />
          ))}
        </div>
      </State>
    </States>
  ),
};
