import type { Meta, StoryObj } from "@storybook/react-vite";
import { MoreHorizontal } from "lucide-react";
import { Button } from "../components/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "../components/dialog";
import { Drawer, DrawerContent, DrawerTrigger } from "../components/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/dropdown-menu";
import { IconButton } from "../components/icon-button";
import { KeyValue } from "../components/key-value";
import { Popover, PopoverContent, PopoverTrigger } from "../components/popover";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "../components/sheet";
import { Tooltip, TooltipProvider } from "../components/tooltip";
import { State, States } from "./_helpers";

const meta = { title: "Components/Overlays" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const SheetBottom: Story = {
  name: "Sheet",
  render: () => (
    <States>
      <State label="Bottom sheet (swipe down, Escape or button to close)">
        <Sheet>
          <SheetTrigger asChild>
            <Button>Choose a service</Button>
          </SheetTrigger>
          <SheetContent
            title="What do you need?"
            description="Pick the closest match. You can add details next."
          >
            <div className="flex flex-col gap-3">
              <Button variant="outline">Flat tire</Button>
              <Button variant="outline">Won&apos;t start</Button>
              <SheetClose asChild>
                <Button variant="ghost">Close</Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </State>
    </States>
  ),
};

export const DialogModal: Story = {
  name: "Dialog",
  render: () => (
    <States>
      <State label="Confirmation dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive">Cancel request</Button>
          </DialogTrigger>
          <DialogContent
            title="Cancel this request?"
            description="The provider on the way will be told right away."
          >
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <DialogClose asChild>
                <Button variant="outline">Keep request</Button>
              </DialogClose>
              <Button variant="destructive">Cancel request</Button>
            </div>
          </DialogContent>
        </Dialog>
      </State>
    </States>
  ),
};

export const DrawerPanel: Story = {
  name: "Drawer",
  render: () => (
    <States>
      <State label="Side panel">
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline">Open request R-7KQ2</Button>
          </DrawerTrigger>
          <DrawerContent title="Request R-7KQ2" description="Flat tire · Test Metro">
            <KeyValue
              items={[
                { label: "Status", value: "Quoting" },
                { label: "Created", value: "10:02" },
                { label: "Channel", value: "Web" },
              ]}
            />
          </DrawerContent>
        </Drawer>
      </State>
    </States>
  ),
};

export const PopoverTooltipMenu: Story = {
  name: "Popover, tooltip, menu",
  render: () => (
    <TooltipProvider>
      <States>
        <State label="Popover">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">What does this fee cover?</Button>
            </PopoverTrigger>
            <PopoverContent className="max-w-xs">
              The flat fee is charged to the provider only when you pick their quote.
            </PopoverContent>
          </Popover>
        </State>
        <State label="Tooltip">
          <Tooltip content="Verified insurance on file">
            <Button variant="ghost">Insured</Button>
          </Tooltip>
        </State>
        <State label="Dropdown menu">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="More actions" icon={<MoreHorizontal />} variant="outline" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Request</DropdownMenuLabel>
              <DropdownMenuItem>Reassign</DropdownMenuItem>
              <DropdownMenuItem>Add note</DropdownMenuItem>
              <DropdownMenuItem disabled>Refund (not available)</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive>Cancel request</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </State>
      </States>
    </TooltipProvider>
  ),
};
