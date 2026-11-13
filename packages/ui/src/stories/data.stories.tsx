import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import { CommandPalette } from "../components/command-palette";
import {
  type ColumnDef,
  DataTable,
  useSavedViews,
  type DataTableView,
} from "../components/data-table";
import { KeyValue } from "../components/key-value";
import { StatCard } from "../components/stat-card";
import { Timeline } from "../components/timeline";
import { State, States } from "./_helpers";

const meta = { title: "Components/Data" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

type Req = { id: string; code: string; service: string; status: string; minutes: number };
const services = ["Flat tire", "Won't start", "Locked out", "Out of gas", "Basic tow"];
const statuses = ["Quoting", "Accepted", "En route", "Completed", "Cancelled"];
function makeRows(n: number): Req[] {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i),
    code: `R-${(i + 1000).toString(36).toUpperCase()}`,
    service: services[i % services.length]!,
    status: statuses[i % statuses.length]!,
    minutes: (i * 7) % 60,
  }));
}
const columns: ColumnDef<Req, unknown>[] = [
  { accessorKey: "code", header: "Request" },
  { accessorKey: "service", header: "Service" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => (
      <Badge
        tone={
          getValue() === "Cancelled" ? "critical" : getValue() === "Completed" ? "success" : "info"
        }
      >
        {String(getValue())}
      </Badge>
    ),
  },
  { accessorKey: "minutes", header: "Age (min)" },
];

export const Table: Story = {
  render: function Render() {
    const data = useMemo(() => makeRows(240), []);
    const { views, saveView } = useSavedViews("storybook-requests-views");
    const [view, setView] = useState<DataTableView | undefined>();
    const [current, setCurrent] = useState<DataTableView | null>(null);
    return (
      <States>
        <State label="Sorting, search, column visibility, selection, pagination, saved views">
          <div className="w-full">
            <DataTable<Req>
              caption="Requests"
              data={data}
              columns={columns}
              getRowId={(r) => r.id}
              enableSelection
              view={view}
              onViewChange={setCurrent}
              toolbar={
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => current && saveView("My view", current)}
                  >
                    Save view
                  </Button>
                  {Object.keys(views).map((name) => (
                    <Button
                      key={name}
                      variant="ghost"
                      size="sm"
                      onClick={() => setView(views[name])}
                    >
                      {name}
                    </Button>
                  ))}
                </div>
              }
            />
          </div>
        </State>
      </States>
    );
  },
};

export const TenThousandRows: Story = {
  name: "Table (10,000 rows, virtual)",
  render: function Render() {
    const data = useMemo(() => makeRows(10_000), []);
    return (
      <States>
        <State label="Virtualized: only visible rows are in the page">
          <div className="w-full">
            <DataTable<Req>
              caption="All requests"
              data={data}
              columns={columns}
              getRowId={(r) => r.id}
              mode="virtual"
              height={560}
            />
          </div>
        </State>
      </States>
    );
  },
};

export const StatsAndDetails: Story = {
  render: () => (
    <States>
      <State label="Stat cards">
        <StatCard
          label="Requests today"
          value="128"
          change={{ value: "+12%", direction: "up", good: true }}
        />
        <StatCard
          label="Median time to first quote"
          value="2m 41s"
          change={{ value: "+18s", direction: "up", good: false }}
        />
        <StatCard label="Active providers" value="—" hint="Shown when data exists" />
      </State>
      <State label="Key-value">
        <KeyValue
          columns={2}
          className="w-full max-w-lg"
          items={[
            { label: "Service", value: "Flat tire" },
            { label: "Vehicle", value: "2019 Test Sedan, gray" },
            { label: "Quoted price", value: "$95.00" },
            { label: "ETA", value: "14 min" },
          ]}
        />
      </State>
      <State label="Timeline">
        <Timeline
          className="w-full max-w-md"
          items={[
            { id: "4", title: "Provider arrived", time: "10:31", tone: "success" },
            { id: "3", title: "Quote accepted", time: "10:09", tone: "info" },
            { id: "2", title: "3 quotes received", time: "10:05" },
            { id: "1", title: "Request created", time: "10:02" },
          ]}
        />
      </State>
    </States>
  ),
};

export const Palette: Story = {
  name: "Command palette",
  render: function Render() {
    const [open, setOpen] = useState(false);
    const log = (what: string) => () => console.info(what);
    return (
      <States>
        <State label="Press Ctrl+K or Cmd+K">
          <Button variant="outline" onClick={() => setOpen(true)}>
            Open command palette
          </Button>
          <CommandPalette
            open={open}
            onOpenChange={setOpen}
            actions={[
              {
                id: "requests",
                label: "Go to requests",
                group: "Navigate",
                shortcut: "G R",
                onSelect: log("requests"),
              },
              {
                id: "providers",
                label: "Go to providers",
                group: "Navigate",
                shortcut: "G P",
                onSelect: log("providers"),
              },
              {
                id: "markets",
                label: "Go to markets",
                group: "Navigate",
                onSelect: log("markets"),
              },
              {
                id: "new-market",
                label: "Create a market",
                group: "Actions",
                onSelect: log("new market"),
              },
            ]}
          />
        </State>
      </States>
    );
  },
};
