/** Small corner badge shown in every app while demo mode is on (never in production). */
export function DemoBadge({ label, href }: { label: string; href?: string }) {
  const cls =
    "fixed top-2 right-2 z-[60] inline-flex min-h-8 items-center gap-1.5 rounded-full border border-warning-strong/40 bg-warning-subtle px-3 text-xs font-semibold text-warning-strong shadow-sm";
  const dot = <span aria-hidden="true" className="size-2 rounded-full bg-warning" />;
  return href ? (
    <a href={href} className={cls}>
      {dot}
      {label}
    </a>
  ) : (
    <span role="note" className={cls}>
      {dot}
      {label}
    </span>
  );
}
