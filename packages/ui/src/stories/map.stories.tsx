import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { type MapMarker, MapView } from "../components/map-view";
import { State, States } from "./_helpers";

const meta = { title: "Product/MapView" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const center = { lat: 29.4241, lng: -98.4936 };
const key = (import.meta as { env?: Record<string, string | undefined> }).env
  ?.STORYBOOK_GOOGLE_MAPS_API_KEY;

export const WithoutKey: Story = {
  name: "Without a key (placeholder)",
  render: () => (
    <States>
      <State label="No Google Maps key: static placeholder with locations listed">
        <MapView
          className="h-72 w-full max-w-2xl"
          label="Map of your location and the provider"
          center={center}
          markers={[
            { id: "d", kind: "driver", position: center, label: "You: near I-10 exit 570" },
            {
              id: "p",
              kind: "provider",
              position: { lat: 29.44, lng: -98.47 },
              label: "Provider: 12 minutes away",
            },
          ]}
        />
      </State>
    </States>
  ),
};

export const Live: Story = {
  name: "Live (needs STORYBOOK_GOOGLE_MAPS_API_KEY)",
  render: function Render() {
    const [provider, setProvider] = useState({ lat: 29.45, lng: -98.46 });
    useEffect(() => {
      const id = setInterval(
        () => setProvider((p) => ({ lat: p.lat - 0.002, lng: p.lng - 0.002 })),
        2000,
      );
      return () => clearInterval(id);
    }, []);
    const markers: MapMarker[] = [
      { id: "d", kind: "driver", position: center, label: "You" },
      { id: "p", kind: "provider", position: provider, label: "Provider" },
    ];
    return (
      <States>
        <State label="Provider marker glides toward the driver every 2 seconds">
          <MapView
            apiKey={key}
            className="h-96 w-full max-w-2xl"
            label="Live map"
            center={center}
            markers={markers}
          />
        </State>
      </States>
    );
  },
};
