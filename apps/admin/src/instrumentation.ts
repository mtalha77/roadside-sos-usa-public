import { validateAppEnv } from "@rsos/config/site";

/** Runs once when the server starts: fail fast on invalid environment variables. */
export function register() {
  validateAppEnv();
}
