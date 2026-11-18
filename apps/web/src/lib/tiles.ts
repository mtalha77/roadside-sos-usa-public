/**
 * Order of the home tiles (RSOS-100): the most urgent problems first. Services not listed keep
 * their database order after these. Slugs are service identifiers, not market data.
 */
const FIRST = ["tow", "wont-start", "flat-tire", "locked-out", "out-of-gas", "winch-out"];

export function orderTiles<T extends { slug: string }>(services: T[]): T[] {
  const rank = (slug: string) => {
    const i = FIRST.indexOf(slug);
    return i === -1 ? FIRST.length : i;
  };
  return [...services].sort((a, b) => rank(a.slug) - rank(b.slug));
}
