import type { Meta, StoryObj } from "@storybook/react-vite";
import { BatteryLow, Disc3, Fuel, KeyRound, Mountain, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { BigToggle } from "../components/big-toggle";
import { Button } from "../components/button";
import { CountdownRing } from "../components/countdown-ring";
import { EtaChip } from "../components/eta-chip";
import { UpdatedAgo } from "../components/live-dot";
import { PriceTag } from "../components/price-tag";
import { ProviderCard } from "../components/provider-card";
import { type Quote, QuoteCard, QuoteCardError, QuoteCardSkeleton } from "../components/quote-card";
import { ServiceTile } from "../components/service-tile";
import { REQUEST_STATUSES, StatusPill } from "../components/status-pill";
import { SwipeToConfirm } from "../components/swipe-to-confirm";
import { State, States } from "./_helpers";

const meta = { title: "Product/Components" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const services = [
  { slug: "flat-tire", label: "Flat tire", hint: "Spare change or plug", icon: <Disc3 /> },
  { slug: "wont-start", label: "Won't start", hint: "Jump start", icon: <BatteryLow /> },
  { slug: "locked-out", label: "Locked out", hint: "Keys inside", icon: <KeyRound /> },
  { slug: "out-of-gas", label: "Out of gas", hint: "Fuel delivery", icon: <Fuel /> },
  { slug: "tow", label: "Basic tow", hint: "To a shop or home", icon: <Truck /> },
  { slug: "winch-out", label: "Winch out", hint: "Stuck in mud or a ditch", icon: <Mountain /> },
];

export const ServiceTiles: Story = {
  render: function Render() {
    const [selected, setSelected] = useState<string | null>("tow");
    return (
      <States>
        <State label="Six services (tap to select; one selected; one disabled)">
          <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
            {services.map((s) => (
              <ServiceTile
                key={s.slug}
                icon={s.icon}
                label={s.label}
                hint={s.hint}
                selected={selected === s.slug}
                disabled={s.slug === "winch-out"}
                onClick={() => setSelected(s.slug)}
              />
            ))}
          </div>
        </State>
      </States>
    );
  },
};

export const StatusEtaPrice: Story = {
  name: "Status, ETA, price",
  render: () => (
    <States>
      <State label="StatusPill: every request state">
        {REQUEST_STATUSES.map((s) => (
          <StatusPill key={s} status={s} />
        ))}
      </State>
      <State label="ETAChip">
        <EtaChip minutes={4} />
        <EtaChip minutes={12} />
        <EtaChip minutes={45} />
      </State>
      <State label="PriceTag (tabular numbers)">
        <PriceTag cents={9500} size="sm" />
        <PriceTag cents={12850} note="all-in" />
        <PriceTag cents={18900} size="lg" />
      </State>
    </States>
  ),
};

const provider = {
  name: "Test Towing Co",
  rating: 4.8,
  reviewCount: 126,
  insured: true,
  licensed: true,
};
const quotes: Quote[] = [
  { id: "1", provider, priceCents: 9500, etaMinutes: 12, tag: "fastest" },
  {
    id: "2",
    provider: {
      name: "Sample Roadside",
      rating: 4.6,
      reviewCount: 41,
      insured: true,
      licensed: false,
    },
    priceCents: 8500,
    etaMinutes: 25,
    tag: "best-price",
  },
  {
    id: "3",
    provider: {
      name: "New Test Provider",
      rating: null,
      reviewCount: 0,
      insured: true,
      licensed: true,
    },
    priceCents: 11000,
    etaMinutes: 18,
  },
];

export const Quotes: Story = {
  render: function Render() {
    const [selected, setSelected] = useState<string | null>(null);
    return (
      <States>
        <State label="QuoteCard: fastest, best price, new provider (selectable)">
          <div className="grid w-full max-w-md gap-5">
            {quotes.map((q) => (
              <QuoteCard
                key={q.id}
                quote={q}
                selected={selected === q.id}
                onSelect={(x) => setSelected(x.id)}
              />
            ))}
          </div>
        </State>
        <State label="Loading and error">
          <div className="grid w-full max-w-md gap-4">
            <QuoteCardSkeleton />
            <QuoteCardError
              message="We couldn't load this quote."
              action={
                <Button size="sm" variant="outline">
                  Retry
                </Button>
              }
            />
          </div>
        </State>
        <State label="ProviderCard">
          <ProviderCard
            className="w-full max-w-md"
            provider={provider}
            meta="Arrives in about 12 minutes"
          />
        </State>
      </States>
    );
  },
};

export const Countdown: Story = {
  render: function Render() {
    const [start] = useState(() => Date.now());
    return (
      <States>
        <State label="Waiting for quotes (3 minutes)">
          <CountdownRing
            label="Time left to receive quotes"
            startsAt={start}
            endsAt={start + 180_000}
          />
        </State>
        <State label="Almost done and finished">
          <CountdownRing
            label="Almost done"
            startsAt={start - 170_000}
            endsAt={start + 10_000}
            size={120}
          />
          <CountdownRing
            label="Finished"
            startsAt={start - 200_000}
            endsAt={start - 1}
            size={120}
          />
        </State>
      </States>
    );
  },
};

export const TogglesAndLive: Story = {
  name: "Toggles and live",
  render: function Render() {
    const [online, setOnline] = useState(false);
    const [at, setAt] = useState(() => Date.now());
    useEffect(() => {
      const id = setInterval(() => setAt(Date.now()), 15_000);
      return () => clearInterval(id);
    }, []);
    return (
      <States>
        <State label="BigToggle: offline, online, loading">
          <div className="grid w-full max-w-md gap-3">
            <BigToggle online={online} onChange={setOnline} />
            <BigToggle online onChange={() => {}} />
            <BigToggle online={false} onChange={() => {}} loading />
          </div>
        </State>
        <State label="SwipeToConfirm: ready and disabled">
          <div className="grid w-full max-w-md gap-3">
            <SwipeToConfirm label="Slide to accept job" onConfirm={() => {}} />
            <SwipeToConfirm label="Slide to mark arrived" onConfirm={() => {}} disabled />
          </div>
        </State>
        <State label="Live indicator">
          <UpdatedAgo at={at} />
        </State>
      </States>
    );
  },
};
