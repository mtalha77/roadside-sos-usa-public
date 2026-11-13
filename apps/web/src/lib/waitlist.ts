/** Short-lived cookie carrying the waitlist form result back to the page (no JavaScript needed). */
export const WAITLIST_FLASH = "rsos_waitlist";
export const WAITLIST_RESULTS = ["joined", "email", "zip", "limit", "generic"] as const;
export type WaitlistResult = (typeof WAITLIST_RESULTS)[number];
