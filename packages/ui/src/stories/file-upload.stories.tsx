import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileUpload } from "../components/file-upload";
import { State, States } from "./_helpers";

const meta = {
  title: "Components/FileUpload",
  component: FileUpload,
  args: { label: "Upload insurance" },
} satisfies Meta<typeof FileUpload>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AllStates: Story = {
  render: () => (
    <States>
      <State label="Documents (PDF or image, 10 MB)">
        <div className="w-full max-w-md">
          <FileUpload
            label="Upload insurance certificate"
            hint="PDF, JPG or PNG up to 10 MB"
            accept="application/pdf,image/*"
            maxSize={10 * 1024 * 1024}
          />
        </div>
      </State>
      <State label="Photos with the camera on phones">
        <div className="w-full max-w-md">
          <FileUpload
            label="Take or choose photos"
            hint="Photos help the provider bring the right equipment"
            accept="image/*"
            capture="environment"
            multiple
          />
        </div>
      </State>
    </States>
  ),
};
