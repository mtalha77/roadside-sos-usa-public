import { toHex } from "./color";
import { amber, ink, themes } from "./tokens";

/** Hex values for places that cannot use CSS variables (browser chrome, generated icons, emails). */
export const themeColor = {
  light: toHex(themes.light.background!),
  dark: toHex(themes.dark.background!),
};
export const iconColors = { background: toHex(amber[500]), foreground: toHex(ink[950]) };
