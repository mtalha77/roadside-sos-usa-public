import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";
import "./storybook.css";

const preview: Preview = {
  decorators: [
    withThemeByClassName({ themes: { light: "", dark: "dark" }, defaultTheme: "light" }),
  ],
  parameters: {
    // Fail the a11y panel on violations (WCAG 2.2 AA is a release requirement).
    a11y: { test: "error" },
    viewport: {
      options: {
        phone: { name: "Phone 375", styles: { width: "375px", height: "812px" } },
        desktop: { name: "Desktop 1440", styles: { width: "1440px", height: "900px" } },
      },
    },
  },
};

export default preview;
