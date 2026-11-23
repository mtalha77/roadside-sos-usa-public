import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { CurrencyInput } from "../components/currency-input";
import { Field } from "../components/field";
import { Input, Textarea } from "../components/input";
import { OTPInput } from "../components/otp-input";
import { PhoneInput } from "../components/phone-input";
import { State, States } from "./_helpers";

const meta = { title: "Components/Inputs" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const TextFields: Story = {
  render: () => (
    <States>
      <State label="Input and Textarea: default, description, error, disabled">
        <div className="grid w-full max-w-md gap-4">
          <Field label="Full name">{({ id }) => <Input id={id} placeholder="Jane Doe" />}</Field>
          <Field
            label="Landmark"
            description="A mile marker or nearby store helps the provider find you."
          >
            {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} />}
          </Field>
          <Field label="Email" error="Enter a valid email" required>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                defaultValue="jane@"
              />
            )}
          </Field>
          <Field label="Disabled">
            {({ id }) => <Input id={id} disabled defaultValue="Read only" />}
          </Field>
          <Field label="Notes">
            {({ id }) => <Textarea id={id} placeholder="Anything else the provider should know" />}
          </Field>
        </div>
      </State>
    </States>
  ),
};

export const Phone: Story = {
  render: function Render() {
    const [e164, setE164] = useState<string | null>(null);
    return (
      <States>
        <State label="US phone (formats as you type; emits E.164)">
          <div className="grid w-full max-w-md gap-2">
            <Field label="Mobile number">
              {({ id }) => <PhoneInput id={id} onValueChange={setE164} />}
            </Field>
            <p className="text-sm text-muted-foreground">Value: {e164 ?? "incomplete"}</p>
            <Field label="Invalid" error="Enter a 10-digit US number">
              {({ id, describedBy, invalid }) => (
                <PhoneInput
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  value="+1512555"
                />
              )}
            </Field>
          </div>
        </State>
      </States>
    );
  },
};

export const OneTimeCode: Story = {
  render: () => (
    <States>
      <State label="Empty">
        <OTPInput aria-label="Verification code" />
      </State>
      <State label="Filled">
        <OTPInput aria-label="Filled code" value="123456" />
      </State>
      <State label="Invalid">
        <OTPInput aria-label="Invalid code" value="12" invalid />
      </State>
      <State label="Disabled">
        <OTPInput aria-label="Disabled code" disabled />
      </State>
    </States>
  ),
};

export const Currency: Story = {
  render: () => (
    <States>
      <State label="USD in whole cents">
        <div className="grid w-full max-w-xs gap-4">
          <Field label="Your price">{({ id }) => <CurrencyInput id={id} value={12850} />}</Field>
          <Field label="Empty">{({ id }) => <CurrencyInput id={id} />}</Field>
        </div>
      </State>
    </States>
  ),
};
