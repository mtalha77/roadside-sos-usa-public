import type { Meta, StoryObj } from "@storybook/react-vite";
import { Phone, Search } from "lucide-react";
import { Button } from "../components/button";
import { IconButton } from "../components/icon-button";
import { State, States } from "./_helpers";

const meta = { title: "Components/Button", component: Button } satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AllStates: Story = {
  render: () => (
    <States>
      <State label="Variants">
        <Button>Get help now</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Cancel request</Button>
        <Button variant="link">Learn more</Button>
      </State>
      <State label="Sizes">
        <Button size="sm">Small</Button>
        <Button>Default</Button>
        <Button size="lg">Large</Button>
      </State>
      <State label="Icon, loading, disabled">
        <Button icon={<Phone />}>Call</Button>
        <Button loading>Sending</Button>
        <Button disabled>Disabled</Button>
      </State>
      <State label="IconButton">
        <IconButton label="Search" icon={<Search />} />
        <IconButton label="Call" icon={<Phone />} variant="outline" />
      </State>
    </States>
  ),
};
