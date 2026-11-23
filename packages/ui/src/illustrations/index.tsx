import { createIllustration, muted, surface } from "./create-illustration";

/** How it works, step 1: share where you are and what happened. */
export const ShareLocationArt = createIllustration(
  "ShareLocationArt",
  <>
    <rect x="52" y="14" width="56" height="92" rx="10" {...surface} />
    <path d="M72 22h16" />
    <path d="M60 34h40v40H60z" {...muted} />
    <path
      d="M80 44c-5.5 0-9 4-9 8.5 0 6.5 9 13.5 9 13.5s9-7 9-13.5C89 48 85.5 44 80 44z"
      {...surface}
    />
    <circle cx="80" cy="52.5" r="3" />
    <path d="M62 84h24M62 92h36" />
  </>,
);

/** How it works, step 2: quotes arrive and you compare them. */
export const CompareQuotesArt = createIllustration(
  "CompareQuotesArt",
  <>
    <rect x="38" y="20" width="84" height="22" rx="6" {...surface} />
    <rect x="38" y="48" width="84" height="22" rx="6" {...surface} />
    <rect x="38" y="76" width="84" height="22" rx="6" {...surface} />
    <circle cx="50" cy="31" r="5" {...muted} />
    <circle cx="50" cy="59" r="5" {...muted} />
    <circle cx="50" cy="87" r="5" {...muted} />
    <path d="M60 29h26M60 57h20M60 85h30" />
    <path d="M102 31h10M104 59h8M100 87h12" />
  </>,
);

/** How it works, step 3: pick one and track the arrival. */
export const TrackArrivalArt = createIllustration(
  "TrackArrivalArt",
  <>
    <rect x="22" y="18" width="116" height="80" rx="10" {...muted} />
    <path d="M38 82c14-18 26-6 40-20s30-10 44-28" strokeDasharray="4 6" />
    <circle cx="38" cy="82" r="5" {...surface} />
    <path d="M122 22c-5 0-8 3.6-8 7.6 0 5.8 8 12 8 12s8-6.2 8-12c0-4-3-7.6-8-7.6z" {...surface} />
    <rect x="68" y="56" width="20" height="12" rx="3" {...surface} />
    <circle cx="72" cy="70" r="2.5" />
    <circle cx="84" cy="70" r="2.5" />
  </>,
);

/** Empty state: no requests yet. */
export const NoRequestsArt = createIllustration(
  "NoRequestsArt",
  <>
    <rect x="50" y="18" width="60" height="80" rx="8" {...surface} />
    <rect x="66" y="12" width="28" height="12" rx="4" {...muted} />
    <path d="M62 44h36M62 56h28M62 68h32" opacity="0.5" />
    <circle cx="108" cy="86" r="14" {...surface} />
    <path d="M102 86h12" />
  </>,
);

/** Empty state: waiting for quotes. */
export const WaitingArt = createIllustration(
  "WaitingArt",
  <>
    <circle cx="80" cy="58" r="34" {...surface} />
    <circle cx="80" cy="58" r="26" strokeDasharray="3 7" />
    <path d="M80 42v16l10 8" />
    <path d="M38 26l8 6M122 26l-8 6M30 64h8M122 64h8" opacity="0.5" />
  </>,
);

/** Empty state: not in your area yet. */
export const NotInAreaArt = createIllustration(
  "NotInAreaArt",
  <>
    <path d="M26 28l36-10 36 10 36-10v74l-36 10-36-10-36 10z" {...muted} />
    <path d="M62 18v74M98 28v74" opacity="0.5" />
    <circle cx="80" cy="56" r="20" strokeDasharray="4 6" {...surface} />
    <path d="M73 49l14 14M87 49L73 63" />
  </>,
);

/** Empty state: provider is offline. */
export const OfflineArt = createIllustration(
  "OfflineArt",
  <>
    <circle cx="80" cy="56" r="34" {...surface} />
    <path d="M80 36v18" />
    <path d="M66 44a20 20 0 1 0 28 0" />
  </>,
);

/** Job photo: a car loaded on a flatbed tow truck. */
export const TowJobArt = createIllustration(
  "TowJobArt",
  <>
    <path d="M16 86h92l10-12h26v24H16z" {...surface} />
    <path d="M118 74V58h18l8 16" {...surface} />
    <path d="M124 62h8l4 10h-12z" {...muted} />
    <path d="M28 74l10-14h30l12 14z" {...muted} />
    <path d="M40 66h14M58 66h12" />
    <circle cx="36" cy="98" r="8" {...surface} />
    <circle cx="96" cy="98" r="8" {...surface} />
    <circle cx="130" cy="98" r="8" {...surface} />
  </>,
);

/** Job photo: a spare tire going onto a jacked-up car. */
export const TireJobArt = createIllustration(
  "TireJobArt",
  <>
    <path d="M24 78l14-22h46l20 22v14H24z" {...surface} />
    <path d="M44 60h18v14H40zM68 60h12l12 14H68z" {...muted} />
    <circle cx="44" cy="94" r="10" {...surface} />
    <path d="M86 92h14v10H86z" {...muted} />
    <circle cx="124" cy="84" r="16" {...surface} />
    <circle cx="124" cy="84" r="6" {...muted} />
    <path d="M124 68v-6M140 84h6" />
  </>,
);

/** Job photo: jump-starting a battery with cables from a service truck. */
export const JumpJobArt = createIllustration(
  "JumpJobArt",
  <>
    <rect x="22" y="58" width="44" height="34" rx="6" {...surface} />
    <rect x="94" y="58" width="44" height="34" rx="6" {...surface} />
    <path d="M32 58v-6h8v6M48 58v-6h8v6M104 58v-6h8v6M120 58v-6h8v6" />
    <path d="M36 52c0-22 88-22 88 0" />
    <path d="M52 52c0-14 56-14 56 0" strokeDasharray="4 5" />
    <path d="M78 68l-6 10h8l-6 10" />
  </>,
);

/** Job photo: opening a locked car door with a wedge and reach tool. */
export const LockoutJobArt = createIllustration(
  "LockoutJobArt",
  <>
    <path d="M30 96V44a8 8 0 0 1 8-8h60l24 30v30z" {...surface} />
    <path d="M44 46h46l16 20H44z" {...muted} />
    <path d="M96 76h10" />
    <rect x="58" y="74" width="20" height="16" rx="3" {...surface} />
    <path d="M62 74v-5a6 6 0 0 1 12 0v5" />
    <path d="M110 30l-26 44" />
    <path d="M104 26l12 8" />
  </>,
);

export const illustrations = {
  "share-location": ShareLocationArt,
  "compare-quotes": CompareQuotesArt,
  "track-arrival": TrackArrivalArt,
  "no-requests": NoRequestsArt,
  waiting: WaitingArt,
  "not-in-area": NotInAreaArt,
  offline: OfflineArt,
  "job-tow": TowJobArt,
  "job-tire": TireJobArt,
  "job-jump": JumpJobArt,
  "job-lockout": LockoutJobArt,
} as const;
export type IllustrationKey = keyof typeof illustrations;
