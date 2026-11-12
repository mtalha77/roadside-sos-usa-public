// Lints root-level config files only. Each app and package has its own eslint.config.mjs.
import { baseConfig } from "@rsos/config/eslint/base";

export default [{ ignores: ["apps/**", "packages/**", "supabase/**"] }, ...baseConfig];
