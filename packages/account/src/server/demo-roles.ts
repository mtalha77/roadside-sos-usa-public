/** Demo sign-in roles (RSOS-102: every staff and provider role). */
export const DEMO_ROLES = [
  "provider_owner",
  "provider_manager",
  "provider_operator",
  "admin_super",
  "admin_ops",
  "admin_dispatcher",
  "admin_success",
  "admin_finance",
  "admin_marketing",
  "admin_viewer",
] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export const PROVIDER_DEMO_ROLES = [
  "provider_owner",
  "provider_manager",
  "provider_operator",
] as const;
export const ADMIN_DEMO_ROLES = [
  "admin_super",
  "admin_ops",
  "admin_dispatcher",
  "admin_success",
  "admin_finance",
  "admin_marketing",
  "admin_viewer",
] as const;

/** The database role each demo role signs in as. */
export const DEMO_STAFF_ROLE = {
  admin_super: "super_admin",
  admin_ops: "ops_manager",
  admin_dispatcher: "dispatcher",
  admin_success: "support",
  admin_finance: "finance",
  admin_marketing: "marketing",
  admin_viewer: "read_only",
} as const;
export const DEMO_PROVIDER_ROLE = {
  provider_owner: "owner",
  provider_manager: "manager",
  provider_operator: "operator",
} as const;
