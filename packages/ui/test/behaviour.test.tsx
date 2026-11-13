import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../src/components/button";
import { Combobox } from "../src/components/combobox";
import { CommandPalette } from "../src/components/command-palette";
import { CurrencyInput } from "../src/components/currency-input";
import { DataTable } from "../src/components/data-table";
import { Dialog, DialogContent, DialogTrigger } from "../src/components/dialog";
import { Drawer, DrawerContent } from "../src/components/drawer";
import { FileUpload } from "../src/components/file-upload";
import { OTPInput } from "../src/components/otp-input";
import { PhoneInput } from "../src/components/phone-input";
import { RadioCards } from "../src/components/radio-cards";
import { Sheet, SheetContent, SheetTrigger } from "../src/components/sheet";
import { Switch } from "../src/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/components/tabs";
import { formatCents, formatUsPhone, parseCents, toE164 } from "../src/lib/format";

describe("formatting helpers", () => {
  it("formats US phones and produces E.164 only when complete", () => {
    expect(formatUsPhone("5125550123")).toBe("(512) 555-0123");
    expect(formatUsPhone("+1 512 555")).toBe("(512) 555");
    expect(toE164("(512) 555-0123")).toBe("+15125550123");
    expect(toE164("512555")).toBeNull();
  });
  it("converts currency text to whole cents", () => {
    expect(parseCents("1,234.5")).toBe(123450);
    expect(parseCents("")).toBeNull();
    expect(formatCents(123450)).toBe("1,234.50");
  });
});

describe("inputs", () => {
  it("Button loading is busy and disabled", () => {
    render(<Button loading>Pay</Button>);
    const button = screen.getByRole("button", { name: "Pay" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("PhoneInput formats as you type and emits E.164", async () => {
    const onValueChange = vi.fn();
    render(<PhoneInput aria-label="Phone" onValueChange={onValueChange} />);
    await userEvent.type(screen.getByLabelText("Phone"), "5125550123");
    expect(screen.getByLabelText("Phone")).toHaveValue("(512) 555-0123");
    expect(onValueChange).toHaveBeenLastCalledWith("+15125550123");
  });

  it("OTPInput accepts a pasted code and completes", async () => {
    const onComplete = vi.fn();
    render(<OTPInput aria-label="Code" onComplete={onComplete} />);
    const input = screen.getByLabelText("Code");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    await userEvent.click(input);
    await userEvent.paste("123456");
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith("123456"));
  });

  it("CurrencyInput stores whole cents", async () => {
    const onValueChange = vi.fn();
    render(<CurrencyInput aria-label="Price" onValueChange={onValueChange} />);
    await userEvent.type(screen.getByLabelText("Price"), "128.5");
    expect(onValueChange).toHaveBeenLastCalledWith(12850);
  });

  it("RadioCards move with arrow keys", async () => {
    const onValueChange = vi.fn();
    render(
      <RadioCards
        aria-label="Vehicle"
        defaultValue="car"
        onValueChange={onValueChange}
        options={[
          { value: "car", title: "Car" },
          { value: "suv", title: "SUV" },
        ]}
      />,
    );
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Car" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "SUV" })).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(onValueChange).toHaveBeenCalledWith("suv");
  });

  it("Switch toggles with the keyboard", async () => {
    render(<Switch aria-label="Online" />);
    const sw = screen.getByRole("switch", { name: "Online" });
    sw.focus();
    await userEvent.keyboard(" ");
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("Combobox filters and selects", async () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        aria-label="City"
        onValueChange={onValueChange}
        options={[
          { value: "a", label: "Alpha Metro" },
          { value: "b", label: "Beta Metro" },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "City" }));
    await userEvent.keyboard("Beta");
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("b");
  });

  it("FileUpload rejects the wrong type and oversize files", () => {
    const onReject = vi.fn();
    const onFilesChange = vi.fn();
    const { container } = render(
      <FileUpload
        label="Upload"
        accept="image/*"
        maxSize={10}
        onReject={onReject}
        onFilesChange={onFilesChange}
      />,
    );
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    const ok = new File(["x"], "ok.png", { type: "image/png" });
    const big = new File(["x".repeat(100)], "big.png", { type: "image/png" });
    const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [ok, big, pdf] } });
    expect(onReject).toHaveBeenCalledWith([
      { name: "big.png", reason: "size" },
      { name: "doc.pdf", reason: "type" },
    ]);
    expect(onFilesChange).toHaveBeenCalledWith([ok]);
  });
});

describe("overlays: focus trap, Escape and swipe", () => {
  it("Dialog traps focus and closes with Escape, returning focus to the trigger", async () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent title="Cancel request?">
          <Button>Keep request</Button>
        </DialogContent>
      </Dialog>,
    );
    const trigger = screen.getByRole("button", { name: "Open" });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Cancel request?" });
    for (let i = 0; i < 5; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it("Drawer closes with Escape", async () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent title="Details">
            <Button>Action</Button>
          </DrawerContent>
        </Drawer>
      );
    }
    render(<Harness />);
    await screen.findByRole("dialog", { name: "Details" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Sheet traps focus and closes with Escape", async () => {
    const onOpenChange = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <Sheet
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            onOpenChange(o);
          }}
        >
          <SheetTrigger asChild>
            <Button>Open sheet</Button>
          </SheetTrigger>
          <SheetContent title="Choose a service">
            <Button>Flat tire</Button>
            <Button>Tow</Button>
          </SheetContent>
        </Sheet>
      );
    }
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open sheet" }));
    const sheet = await screen.findByRole("dialog", { name: "Choose a service" });
    for (let i = 0; i < 4; i++) {
      await userEvent.tab();
      expect(sheet.contains(document.activeElement)).toBe(true);
    }
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("Tabs switch with arrow keys", async () => {
    render(
      <Tabs defaultValue="a">
        <TabsList aria-label="Audience">
          <TabsTrigger value="a">Drivers</TabsTrigger>
          <TabsTrigger value="b">Providers</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Drivers content</TabsContent>
        <TabsContent value="b">Providers content</TabsContent>
      </Tabs>,
    );
    screen.getByRole("tab", { name: "Drivers" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Providers" })).toHaveAttribute("aria-selected", "true");
  });

  it("Command palette opens with Ctrl+K and runs the chosen action", async () => {
    const run = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <CommandPalette
          open={open}
          onOpenChange={setOpen}
          actions={[{ id: "req", label: "Go to requests", group: "Navigate", onSelect: run }]}
        />
      );
    }
    render(<Harness />);
    await userEvent.keyboard("{Control>}k{/Control}");
    const dialog = await screen.findByRole("dialog");
    await userEvent.keyboard("requests{Enter}");
    expect(run).toHaveBeenCalled();
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });
});

type Row = { id: string; name: string; value: number };

describe("DataTable", () => {
  const data: Row[] = [
    { id: "a", name: "Charlie", value: 3 },
    { id: "b", name: "Alpha", value: 1 },
    { id: "c", name: "Bravo", value: 2 },
  ];
  const columns = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "value", header: "Value" },
  ];

  it("sorts, filters, hides columns and selects rows", async () => {
    const onSelectionChange = vi.fn();
    render(
      <DataTable<Row>
        caption="Test"
        data={data}
        columns={columns}
        getRowId={(r) => r.id}
        enableSelection
        onSelectionChange={onSelectionChange}
      />,
    );
    const table = screen.getByRole("table");
    const names = () =>
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((r) => r.textContent);
    await userEvent.click(screen.getByRole("button", { name: "Sort by Name" }));
    expect(names()[0]).toContain("Alpha");
    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "Bra");
    expect(names()).toHaveLength(1);
    await userEvent.clear(screen.getByRole("searchbox", { name: "Search" }));
    await userEvent.click(screen.getAllByRole("checkbox", { name: "Select row" })[0]!);
    expect(onSelectionChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ name: "Alpha" }),
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Columns" }));
    await userEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Value" }));
    await userEvent.keyboard("{Escape}");
    expect(within(table).queryByRole("columnheader", { name: /Value/ })).toBeNull();
  });

  it("virtual mode renders only the visible rows of 10,000", () => {
    const big = Array.from({ length: 10_000 }, (_, i) => ({
      id: String(i),
      name: `Row ${i}`,
      value: i,
    }));
    // jsdom has no layout: give the scroll area its real size.
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 1024,
      height: 520,
      top: 0,
      left: 0,
      right: 1024,
      bottom: 520,
      x: 0,
      y: 0,
      toJSON() {},
    } as DOMRect);
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(520);
    vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(1024);
    render(
      <DataTable<Row>
        caption="Big"
        data={big}
        columns={columns}
        getRowId={(r) => r.id}
        mode="virtual"
        height={520}
        rowHeight={52}
      />,
    );
    const bodyRows = screen.getAllByRole("row").filter((r) => r.getAttribute("aria-rowindex"));
    expect(bodyRows.length).toBeGreaterThan(5);
    expect(bodyRows.length).toBeLessThan(60);
    expect(screen.getByRole("table")).toHaveAttribute("aria-rowcount", "10001");
    rect.mockRestore();
    vi.restoreAllMocks();
  });
});
