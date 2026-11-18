import { ui } from "@/lib/ui-classes";

/**
 * Light and dark mode switch for the public website: a plain server-rendered button with inline
 * icons, handled by the site script (`lib/site-script.ts`), so it adds no JavaScript bundle
 * (RSOS-033, RSOS-100). Icons swap with CSS.
 */
export function LightThemeToggle({ label }: { label: string }) {
  const icon = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-theme-toggle
      className={`${ui.button.ghost} min-w-touch px-0`}
    >
      <svg {...icon} aria-hidden="true" className="hidden dark:block">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
      <svg {...icon} aria-hidden="true" className="block dark:hidden">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    </button>
  );
}
