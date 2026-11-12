import { z } from "zod";

/** Values that are safe to ship to the browser. */
export const PublicSupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

/**
 * Server-only values. The service role key bypasses Row Level Security:
 * it must never be prefixed with NEXT_PUBLIC_ or imported into client code.
 */
export const ServerSupabaseEnvSchema = PublicSupabaseEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export function readPublicSupabaseEnv() {
  // Referenced one by one so Next.js can inline NEXT_PUBLIC_ values at build time.
  return PublicSupabaseEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
