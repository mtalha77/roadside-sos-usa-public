import { validateAppEnv } from "@rsos/config/site";
import { assertServiceKeyProject } from "@rsos/db/key-check";

/**
 * Runs once when the server starts: fail fast on invalid environment variables, and log loudly
 * (names only) if the service role key belongs to another Supabase project.
 */
export function register() {
  validateAppEnv();
  assertServiceKeyProject("admin");
}
