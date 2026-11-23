/**
 * Service names come from the messages when translated, otherwise from the database. `tile` is
 * the label on the home tiles (RSOS-100) and falls back to the name.
 */
export function serviceName(
  t: { has: (key: string) => boolean; (key: string): string },
  s: { slug: string; name: string },
  part: "name" | "short" | "tile" = "name",
): string {
  const key = `services.${s.slug}.${part}`;
  if (t.has(key)) return t(key);
  if (part === "tile") return serviceName(t, s, "name");
  return part === "name" ? s.name : "";
}
