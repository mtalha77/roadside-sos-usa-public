import { brand } from "@rsos/config/brand";
import { brandInitials } from "@rsos/config/logo";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
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
        color: "#ffffff",
        fontSize: 75,
        fontWeight: 700,
        borderRadius: 39,
      }}
    >
      {brandInitials()}
    </div>,
    size,
  );
}
