import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/accordion";
import { Alert } from "../components/alert";
import { Avatar } from "../components/avatar";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/card";
import { Divider } from "../components/divider";
import { EmptyState } from "../components/empty-state";
import { Progress } from "../components/progress";
import { Skeleton } from "../components/skeleton";
import { Stepper } from "../components/stepper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/tabs";
import { Toaster, toast } from "../components/toast";
import { State, States } from "./_helpers";

const meta = { title: "Components/Layout and feedback" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Cards: Story = {
  render: () => (
    <States>
      <State label="Card">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Your request</CardTitle>
            <CardDescription>Flat tire · sent 1 minute ago</CardDescription>
          </CardHeader>
          <CardContent>Waiting for quotes from providers nearby.</CardContent>
          <CardFooter>
            <Button variant="outline">Edit details</Button>
          </CardFooter>
        </Card>
      </State>
      <State label="Loading (skeleton)">
        <div
          aria-busy="true"
          className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border p-5"
        >
          <span className="sr-only">Loading</span>
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </State>
      <State label="Empty state">
        <EmptyState
          className="w-full max-w-md"
          title="No requests yet"
          description="New requests in your area show up here."
          action={<Button variant="outline">Refresh</Button>}
        />
      </State>
    </States>
  ),
};

export const Alerts: Story = {
  render: () => (
    <States>
      <State label="Tones">
        <div className="grid w-full max-w-xl gap-3">
          <Alert tone="info" title="Quotes usually arrive in about 3 minutes" />
          <Alert tone="success" title="Provider on the way">
            Arriving in about 12 minutes.
          </Alert>
          <Alert tone="warning" title="Running late">
            The provider is delayed by traffic.
          </Alert>
          <Alert tone="critical" title="Payment failed">
            Your card was declined. Try another card.
          </Alert>
        </div>
      </State>
      <State label="Badges">
        <Badge>Neutral</Badge>
        <Badge tone="info">New</Badge>
        <Badge tone="success">Insured</Badge>
        <Badge tone="warning">Low balance</Badge>
        <Badge tone="critical">Suspended</Badge>
        <Badge tone="signal">Fastest</Badge>
        <Badge tone="outline">Licensed</Badge>
      </State>
      <State label="Toast">
        <Toaster />
        <Button
          variant="outline"
          onClick={() => toast.success("Saved", { description: "Your changes are live." })}
        >
          Show toast
        </Button>
      </State>
    </States>
  ),
};

export const Navigation: Story = {
  render: () => (
    <States>
      <State label="Tabs">
        <Tabs defaultValue="drivers" className="w-full max-w-md">
          <TabsList aria-label="Audience" className="w-full">
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
            <TabsTrigger value="providers">Providers</TabsTrigger>
          </TabsList>
          <TabsContent value="drivers">Request help in under a minute.</TabsContent>
          <TabsContent value="providers">Get jobs near you.</TabsContent>
        </Tabs>
      </State>
      <State label="Accordion">
        <Accordion type="single" collapsible className="w-full max-w-md">
          <AccordionItem value="1">
            <AccordionTrigger>How fast do quotes arrive?</AccordionTrigger>
            <AccordionContent>Usually within about 3 minutes.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="2">
            <AccordionTrigger>Who do I pay?</AccordionTrigger>
            <AccordionContent>You pay the provider directly.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </State>
      <State label="Stepper">
        <Stepper
          className="w-full max-w-lg"
          label="Request progress"
          steps={["Location", "Problem", "Contact", "Quotes"]}
          current={2}
        />
      </State>
      <State label="Progress: value and indeterminate">
        <div className="grid w-full max-w-md gap-3">
          <Progress value={64} label="Upload progress" />
          <Progress value={null} label="Loading" />
        </div>
      </State>
      <State label="Avatar and divider">
        <Avatar name="Test Driver" />
        <Avatar name="Test Towing" size="lg" />
        <Divider orientation="vertical" className="h-12" />
        <Avatar name="Sam" size="sm" />
      </State>
    </States>
  ),
};
