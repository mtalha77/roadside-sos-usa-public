import type { Meta, StoryObj } from "@storybook/react-vite";
import { DemoBadge } from "../components/demo-badge";
import { LiteMap } from "../components/lite-map";
import { State, States } from "./_helpers";

const meta = { title: "Product/Demo and LiteMap" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const here = { lat: 29.4241, lng: -98.4936 };
const base = { lat: 29.5079, lng: -98.5767 };

export const Badge: Story = {
  render: () => (
    <States>
      <State label="Demo data badge (top right, demo mode only)">
        <div className="relative h-16">
          <DemoBadge label="Demo data" />
        </div>
      </State>
    </States>
  ),
};

export const Map: Story = {
  render: () => (
    <States>
      <State label="Tracking: truck on the way">
        <LiteMap
          className="max-w-xl"
          label="Provider on the way to the driver"
          route={{ from: base, to: here }}
          points={[
            { id: "r", kind: "request", lat: here.lat, lng: here.lng, label: "Driver" },
            {
              id: "t",
              kind: "truck",
              lat: (here.lat + base.lat) / 2,
              lng: (here.lng + base.lng) / 2,
              label: "Truck",
            },
          ]}
        />
      </State>
      <State label="Service area (25 miles)">
        <LiteMap
          className="max-w-xl"
          label="Service area"
          radius={{ center: here, miles: 25 }}
          points={[{ id: "p", kind: "provider", lat: here.lat, lng: here.lng, label: "Base" }]}
        />
      </State>
    </States>
  ),
};
