export const DEMO_ROLES = [
  "provider_owner",
  "provider_operator",
  "admin_super",
  "admin_dispatcher",
] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];
