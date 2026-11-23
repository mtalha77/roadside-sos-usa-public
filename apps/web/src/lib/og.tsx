import { brand } from "@rsos/config/brand";
import { iconColors, themeColor } from "@rsos/config/theme-colors";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** Generated social image: ink background, one amber signal bar, the page title. No stock art. */
export function ogImage(title: string, subtitle?: string) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        background: themeColor.dark,
        color: themeColor.light,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          fontSize: 36,
          fontWeight: 700,
        }}
      >
        <div
          style={{ width: 20, height: 56, borderRadius: 6, background: iconColors.background }}
        />
        {brand.name}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 34, color: themeColor.light, opacity: 0.75 }}>{subtitle}</div>
        ) : null}
      </div>
    </div>,
    OG_SIZE,
  );
}
