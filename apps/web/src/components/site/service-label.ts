/** Service names come from the messages when translated, otherwise from the database. */
export function serviceName(
  t: { has: (key: string) => boolean; (key: string): string },
  s: { slug: string; name: string },
  part: "name" | "short" = "name",
): string {
  const key = `services.${s.slug}.${part}`;
  return t.has(key) ? t(key) : part === "name" ? s.name : "";
}
