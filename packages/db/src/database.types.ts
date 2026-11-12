/**
 * Placeholder until the first migration exists.
 * Regenerate with `pnpm --filter @rsos/db gen:types` after every schema change.
 */
type Empty = Record<string, never>;

export type Database = {
  public: {
    Tables: Empty;
    Views: Empty;
    Functions: Empty;
    Enums: Empty;
    CompositeTypes: Empty;
  };
};
