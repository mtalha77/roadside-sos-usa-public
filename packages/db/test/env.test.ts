import { describe, expect, it } from "vitest";
import { PublicSupabaseEnvSchema, ServerSupabaseEnvSchema } from "../src/env";

const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
};

describe("Supabase env schemas", () => {
  it("accepts valid public values", () => {
    expect(PublicSupabaseEnvSchema.parse(publicEnv)).toEqual(publicEnv);
  });

  it("rejects a missing or malformed URL", () => {
    expect(
      PublicSupabaseEnvSchema.safeParse({ ...publicEnv, NEXT_PUBLIC_SUPABASE_URL: "nope" }).success,
    ).toBe(false);
  });

  it("requires the service role key only in the server schema", () => {
    expect(ServerSupabaseEnvSchema.safeParse(publicEnv).success).toBe(false);
    expect(
      ServerSupabaseEnvSchema.safeParse({ ...publicEnv, SUPABASE_SERVICE_ROLE_KEY: "test-secret" })
        .success,
    ).toBe(true);
  });

  it("the public schema never contains the service role key", () => {
    expect(Object.keys(PublicSupabaseEnvSchema.shape)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
