import { brand } from "@rsos/config/brand";
import { brandInitials } from "@rsos/config/logo";
import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** App icon generated from the brand short name and colour (rename-ready). */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: brand.color,
        color: brand.colorForeground,
        fontSize: 215,
        fontWeight: 700,
        borderRadius: 112,
      }}
    >
      {brandInitials()}
    </div>,
    size,
  );
}
