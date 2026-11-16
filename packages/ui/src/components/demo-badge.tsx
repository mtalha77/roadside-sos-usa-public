/**
 * Small corner badge shown in every app while demo mode is on (never in production). It sits in
 * the bottom-left corner, above the phone bottom bars, so it never covers header controls (such as
 * the day and night switch); the plain label lets clicks pass through to whatever is underneath.
 */
export function DemoBadge({ label, href }: { label: string; href?: string }) {
  const cls =
    "fixed bottom-24 left-2 z-[60] inline-flex md:bottom-3 min-h-8 items-center gap-1.5 rounded-full border border-warning-strong/40 bg-warning-subtle px-3 text-xs font-semibold text-warning-strong shadow-sm";
  const dot = <span aria-hidden="true" className="size-2 rounded-full bg-warning" />;
  return href ? (
    <a href={href} className={cls}>
      {dot}
      {label}
    </a>
  ) : (
    <span role="note" className={`${cls} pointer-events-none`}>
      {dot}
      {label}
    </span>
  );
}
