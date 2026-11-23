import { createIcon } from "./create-icon";

/** Original service icons (24px grid). Keys match `services.icon_key` in the database. */
export const FlatTireIcon = createIcon(
  "FlatTireIcon",
  <>
    <path d="M6 18.2A7.5 7.5 0 1 1 18 18.2" />
    <path d="M4 19.5h16" />
    <circle cx="12" cy="12.5" r="2.5" />
    <path d="M12 6.5v3.5M6.5 12.5H9.5M14.5 12.5h3" />
  </>,
);

export const WontStartIcon = createIcon(
  "WontStartIcon",
  <>
    <rect x="3" y="7" width="18" height="12" rx="2" />
    <path d="M7 7V5h3v2M14 7V5h3v2" />
    <path d="M12.5 10l-2 3h3l-2 3" />
  </>,
);

export const LockedOutIcon = createIcon(
  "LockedOutIcon",
  <>
    <circle cx="7.5" cy="12" r="4" />
    <circle cx="7.5" cy="12" r="1" />
    <path d="M11.5 12H21M17.5 12v3M20.5 12v2" />
  </>,
);

export const OutOfGasIcon = createIcon(
  "OutOfGasIcon",
  <>
    <path d="M5 21h11a1 1 0 0 0 1-1V8l-4-4H7.5L5 6.5z" />
    <path d="M8 4V2.5h3V4" />
    <path d="M8.5 11.5l5 5M13.5 11.5l-5 5" />
    <path d="M17 9l2.5-2.5V12" />
  </>,
);

export const TowIcon = createIcon(
  "TowIcon",
  <>
    <path d="M3 17v-6a1 1 0 0 1 1-1h4.5l2.5 3h3v4" />
    <path d="M14 13l6-6v7" />
    <path d="M20 14a1.5 1.5 0 1 1-1.5 1.5" />
    <circle cx="6.5" cy="17.5" r="1.5" />
    <circle cx="12" cy="17.5" r="1.5" />
    <path d="M8 17.5h2.5" />
  </>,
);

export const WinchOutIcon = createIcon(
  "WinchOutIcon",
  <>
    <path d="M2 20.5c2.5-1.2 4.5-1.2 7 0s4.5 1.2 7 0 4.5-1.2 6 0" />
    <path d="M3.5 17l1.6-4.2 5.4-1.3 3 2.4.4 3.1z" />
    <path d="M13.5 13.5L20 7" />
    <path d="M20 4v6M18 4h4" />
  </>,
);

export const serviceIcons = {
  "flat-tire": FlatTireIcon,
  "wont-start": WontStartIcon,
  "locked-out": LockedOutIcon,
  "out-of-gas": OutOfGasIcon,
  tow: TowIcon,
  "winch-out": WinchOutIcon,
} as const;
export type ServiceIconKey = keyof typeof serviceIcons;
