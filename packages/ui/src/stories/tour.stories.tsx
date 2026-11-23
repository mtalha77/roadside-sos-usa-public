import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tour } from "../components/tour";

const meta = { title: "Product/Guided tour" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const labels = {
  back: "Back",
  next: "Next",
  done: "Done",
  skip: "Skip tour",
  hide: "Don't show again",
  step: "Step {n} of {total}",
};

/** One step spotlighting a button, with Back, Next, Skip tour and Don't show again (RSOS-105). */
export const Spotlight: Story = {
  render: () => (
    <div className="p-10">
      <button type="button" data-tour="story-target" className="rounded-lg border px-4 py-3">
        Dispatch board
      </button>
      <Tour
        open
        labels={labels}
        start={1}
        onEnd={() => {}}
        steps={[
          { title: "Inbox", body: "Everything a person must act on now." },
          {
            target: '[data-tour="story-target"]',
            title: "Dispatch board",
            body: "Live map and lanes for one market at a time.",
          },
        ]}
      />
    </div>
  ),
};
