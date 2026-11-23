/** A same-site path to send the visitor back to after a form post (never another site). */
export function safeReturn(raw: unknown, fallback = "/"): string {
  return typeof raw === "string" &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.includes("\\")
    ? raw
    : fallback;
}
