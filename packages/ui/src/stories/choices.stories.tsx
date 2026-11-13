import type { Meta, StoryObj } from "@storybook/react-vite";
import { Car, Truck } from "lucide-react";
import { Checkbox } from "../components/checkbox";
import { Combobox } from "../components/combobox";
import { DatePicker } from "../components/date-picker";
import { Field } from "../components/field";
import { RadioCards } from "../components/radio-cards";
import { Select } from "../components/select";
import { Slider } from "../components/slider";
import { Switch } from "../components/switch";
import { State, States } from "./_helpers";

const meta = { title: "Components/Choices" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const services = [
  { value: "flat-tire", label: "Flat tire" },
  { value: "wont-start", label: "Won't start" },
  { value: "locked-out", label: "Locked out" },
  { value: "out-of-gas", label: "Out of gas" },
  { value: "tow", label: "Basic tow" },
  { value: "winch-out", label: "Winch out", disabled: true },
];

export const SelectAndCombobox: Story = {
  render: () => (
    <States>
      <State label="Select: placeholder, value, invalid, disabled">
        <div className="grid w-full max-w-md gap-4">
          <Field label="Service">
            {({ id }) => <Select id={id} options={services} placeholder="Choose a service" />}
          </Field>
          <Field label="With value">
            {({ id }) => <Select id={id} options={services} defaultValue="tow" />}
          </Field>
          <Field label="Invalid" error="Choose a service">
            {({ id, describedBy, invalid }) => (
              <Select id={id} aria-describedby={describedBy} invalid={invalid} options={services} />
            )}
          </Field>
          <Field label="Disabled">
            {({ id }) => <Select id={id} options={services} disabled />}
          </Field>
        </div>
      </State>
      <State label="Combobox (searchable)">
        <div className="w-full max-w-md">
          <Field label="Vehicle make">
            {({ id }) => (
              <Combobox
                id={id}
                aria-label="Vehicle make"
                options={["Ford", "Toyota", "Honda", "Chevrolet", "Nissan", "Tesla"].map((m) => ({
                  value: m.toLowerCase(),
                  label: m,
                }))}
              />
            )}
          </Field>
        </div>
      </State>
      <State label="Date picker">
        <div className="w-full max-w-md">
          <Field label="Insurance expiry">{({ id }) => <DatePicker id={id} />}</Field>
        </div>
      </State>
    </States>
  ),
};

export const ChecksAndToggles: Story = {
  render: () => (
    <States>
      <State label="Checkbox: unchecked, checked, disabled">
        <Checkbox label="Keys are with the vehicle" />
        <Checkbox label="I'm in a safe spot" defaultChecked />
        <Checkbox label="Disabled" disabled />
      </State>
      <State label="Switch: off, on, disabled">
        <Switch aria-label="Off" />
        <Switch aria-label="On" defaultChecked />
        <Switch aria-label="Disabled" disabled />
      </State>
      <State label="Slider: single, range, disabled">
        <div className="grid w-full max-w-md gap-4">
          <Slider aria-label="Service radius" defaultValue={[15]} max={50} />
          <Slider aria-label="Price range" defaultValue={[50, 150]} max={300} />
          <Slider aria-label="Disabled slider" defaultValue={[20]} disabled />
        </div>
      </State>
      <State label="Radio cards">
        <RadioCards
          aria-label="Vehicle type"
          defaultValue="car"
          className="w-full max-w-xl"
          options={[
            { value: "car", title: "Car", description: "Sedan, hatchback, coupe", icon: <Car /> },
            { value: "pickup", title: "Pickup", description: "Light trucks", icon: <Truck /> },
            {
              value: "rv",
              title: "RV or trailer",
              description: "Not available yet",
              disabled: true,
            },
          ]}
        />
      </State>
    </States>
  ),
};
