import { render } from "@testing-library/react";
import { Search } from "lucide-react";
import { describe, it } from "vitest";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../src/components/accordion";
import { Alert } from "../src/components/alert";
import { Avatar } from "../src/components/avatar";
import { Badge } from "../src/components/badge";
import { Button } from "../src/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../src/components/card";
import { Checkbox } from "../src/components/checkbox";
import { Combobox } from "../src/components/combobox";
import { CommandPalette } from "../src/components/command-palette";
import { CurrencyInput } from "../src/components/currency-input";
import { DataTable } from "../src/components/data-table";
import { DatePicker } from "../src/components/date-picker";
import { Dialog, DialogContent } from "../src/components/dialog";
import { Divider } from "../src/components/divider";
import { Drawer, DrawerContent } from "../src/components/drawer";
import { EmptyState } from "../src/components/empty-state";
import { Field } from "../src/components/field";
import { FileUpload } from "../src/components/file-upload";
import { IconButton } from "../src/components/icon-button";
import { Input, Textarea } from "../src/components/input";
import { KeyValue } from "../src/components/key-value";
import { OTPInput } from "../src/components/otp-input";
import { PhoneInput } from "../src/components/phone-input";
import { Progress } from "../src/components/progress";
import { RadioCards } from "../src/components/radio-cards";
import { Select } from "../src/components/select";
import { Sheet, SheetContent } from "../src/components/sheet";
import { Skeleton } from "../src/components/skeleton";
import { Slider } from "../src/components/slider";
import { StatCard } from "../src/components/stat-card";
import { Stepper } from "../src/components/stepper";
import { Switch } from "../src/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/components/tabs";
import { Timeline } from "../src/components/timeline";
import { Tooltip, TooltipProvider } from "../src/components/tooltip";
import { expectNoAxeViolations } from "./axe";

type Row = { id: string; name: string; city: string };
const rows: Row[] = [
  { id: "1", name: "Test Towing 1", city: "Test Metro" },
  { id: "2", name: "Test Towing 2", city: "Test Metro" },
];

describe("axe: no serious or critical violations", () => {
  it("inputs and actions", async () => {
    render(
      <main>
        <Button>Get help now</Button>
        <Button loading>Saving</Button>
        <IconButton label="Search" icon={<Search />} />
        <Field label="Name">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} />}
        </Field>
        <Field label="Notes" description="Optional">
          {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} />}
        </Field>
        <Field label="Phone" error="Enter a 10-digit number">
          {({ id, describedBy, invalid }) => (
            <PhoneInput id={id} aria-describedby={describedBy} aria-invalid={invalid} />
          )}
        </Field>
        <Field label="Amount">{({ id }) => <CurrencyInput id={id} value={12345} />}</Field>
        <OTPInput aria-label="Verification code" />
        <Select
          aria-label="Service"
          options={[{ value: "tow", label: "Tow" }]}
          placeholder="Choose"
        />
        <Combobox aria-label="City" options={[{ value: "a", label: "Test Metro" }]} />
        <DatePicker aria-label="Date" />
        <Checkbox label="Keys are with the car" />
        <RadioCards
          aria-label="Vehicle"
          options={[
            { value: "car", title: "Car" },
            { value: "suv", title: "SUV" },
          ]}
        />
        <Switch aria-label="Online" />
        <Slider aria-label="Radius" defaultValue={[10]} max={50} />
        <FileUpload label="Upload insurance" hint="PDF or photo, up to 10 MB" />
      </main>,
    );
    await expectNoAxeViolations();
  });

  it("layout, feedback and data", async () => {
    render(
      <TooltipProvider>
        <main>
          <Card>
            <CardHeader>
              <CardTitle>Quote</CardTitle>
              <CardDescription>From a verified provider</CardDescription>
            </CardHeader>
            <CardContent>Body</CardContent>
          </Card>
          <Tabs defaultValue="a">
            <TabsList aria-label="Audience">
              <TabsTrigger value="a">Drivers</TabsTrigger>
              <TabsTrigger value="b">Providers</TabsTrigger>
            </TabsList>
            <TabsContent value="a">Drivers content</TabsContent>
            <TabsContent value="b">Providers content</TabsContent>
          </Tabs>
          <Accordion type="single" collapsible>
            <AccordionItem value="q1">
              <AccordionTrigger>How fast?</AccordionTrigger>
              <AccordionContent>About 3 minutes.</AccordionContent>
            </AccordionItem>
          </Accordion>
          <Tooltip content="Help">
            <Button variant="outline">Hover</Button>
          </Tooltip>
          <Alert tone="critical" title="Payment failed">
            Try another card.
          </Alert>
          <Alert tone="success" title="Saved" />
          <Badge tone="success">Insured</Badge>
          <Avatar name="Test Driver" />
          <Skeleton className="h-6 w-40" />
          <EmptyState title="No requests yet" description="New requests appear here." />
          <Stepper label="Progress" steps={["Location", "Problem", "Quotes"]} current={1} />
          <Progress value={40} label="Upload progress" />
          <Divider />
          <StatCard
            label="Requests"
            value="128"
            change={{ value: "+12%", direction: "up", good: true }}
          />
          <KeyValue items={[{ label: "ETA", value: "12 min" }]} />
          <Timeline items={[{ id: "1", title: "Request created", time: "10:02" }]} />
          <DataTable<Row>
            caption="Providers"
            data={rows}
            getRowId={(r) => r.id}
            enableSelection
            columns={[
              { accessorKey: "name", header: "Name" },
              { accessorKey: "city", header: "City" },
            ]}
          />
        </main>
      </TooltipProvider>,
    );
    await expectNoAxeViolations();
  });

  it("open dialog, drawer, sheet and command palette", async () => {
    const r1 = render(
      <Dialog open>
        <DialogContent title="Cancel request?" description="The provider is notified.">
          <Button>Keep</Button>
        </DialogContent>
      </Dialog>,
    );
    await expectNoAxeViolations();
    r1.unmount();
    const r2 = render(
      <Drawer open>
        <DrawerContent title="Request R-7KQ2">Details</DrawerContent>
      </Drawer>,
    );
    await expectNoAxeViolations();
    r2.unmount();
    const r3 = render(
      <Sheet open>
        <SheetContent title="Choose a service">Options</SheetContent>
      </Sheet>,
    );
    await expectNoAxeViolations();
    r3.unmount();
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        actions={[{ id: "a", label: "Go to requests", group: "Navigate", onSelect: () => {} }]}
      />,
    );
    await expectNoAxeViolations();
  });
});
