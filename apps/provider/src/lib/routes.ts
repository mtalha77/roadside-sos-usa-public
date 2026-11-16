/**
 * Portal screens that exist so far. Navigation shows only these, so no link points at a page that
 * isn't built yet; each Part B ticket adds its route here.
 */
export const BUILT_ROUTES: ReadonlySet<string> = new Set([
  "/",
  "/more",
  "/account",
  "/install",
  "/jobs",
  "/wallet",
  "/services",
]);

export const isBuilt = (href: string) => BUILT_ROUTES.has(href);
