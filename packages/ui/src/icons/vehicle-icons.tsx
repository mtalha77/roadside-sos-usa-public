import { createIcon } from "./create-icon";

/** Original vehicle icons (24px grid, side view facing right). */
const wheels = (a: number, b: number) => (
  <>
    <circle cx={a} cy="16.5" r="1.8" />
    <circle cx={b} cy="16.5" r="1.8" />
  </>
);

export const CarIcon = createIcon(
  "CarIcon",
  <>
    <path d="M4.2 16.5H3v-3.2L5 9h8l4 4.2h3a1 1 0 0 1 1 1v2.3h-2.2" />
    <path d="M7.8 16.5h7.4" />
    <path d="M7 9.5l-.8 3.7H16" />
    {wheels(6, 17)}
  </>,
);

export const SuvIcon = createIcon(
  "SuvIcon",
  <>
    <path d="M4.2 16.5H3V10.5L5 6.5h10l3 4.5h2a1 1 0 0 1 1 1v4.5h-2.2" />
    <path d="M7.8 16.5h7.4" />
    <path d="M3 11h15M10 6.5V11" />
    {wheels(6, 17)}
  </>,
);

export const PickupIcon = createIcon(
  "PickupIcon",
  <>
    <path d="M4.2 16.5H3V12h7V7.5h5l3 4.5h2a1 1 0 0 1 1 1v3.5h-2.2" />
    <path d="M7.8 16.5h7.4" />
    <path d="M10 12h8" />
    {wheels(6, 17)}
  </>,
);

export const MotorcycleIcon = createIcon(
  "MotorcycleIcon",
  <>
    <circle cx="5.5" cy="16" r="3" />
    <circle cx="18.5" cy="16" r="3" />
    <path d="M5.5 16l4-6h5l4 6" />
    <path d="M14.5 10l1.2-3H18" />
    <path d="M8.5 10h4" />
  </>,
);

export const VanIcon = createIcon(
  "VanIcon",
  <>
    <path d="M4.2 16.5H3V8a1 1 0 0 1 1-1h11l4 4h1a1 1 0 0 1 1 1v4.5h-2.2" />
    <path d="M7.8 16.5h7.4" />
    <path d="M15 7v4h4M9.5 7v4" />
    {wheels(6, 17)}
  </>,
);

export const RvTrailerIcon = createIcon(
  "RvTrailerIcon",
  <>
    <rect x="2" y="6" width="15" height="10" rx="1.5" />
    <path d="M17 13.5h4.5" />
    <path d="M5 9.5h3M10.5 9.5h3.5" />
    <circle cx="8" cy="17.5" r="1.8" />
  </>,
);

export const vehicleIcons = {
  car: CarIcon,
  suv: SuvIcon,
  pickup: PickupIcon,
  motorcycle: MotorcycleIcon,
  van: VanIcon,
  rv: RvTrailerIcon,
} as const;
export type VehicleIconKey = keyof typeof vehicleIcons;
