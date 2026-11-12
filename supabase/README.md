# supabase/

| Path          | What goes here                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config.toml` | Local Supabase stack settings (created by `supabase init`).                                                                                               |
| `migrations/` | SQL migrations, one per change, named by `supabase migration new <name>`. Every table gets Row Level Security enabled and policies in the same migration. |
| `seed.sql`    | Test data loaded by `supabase db reset`.                                                                                                                  |
| `functions/`  | Edge Functions (Deno). One folder per function.                                                                                                           |

Local stack (needs Docker Desktop running):

```bash
pnpm exec supabase start
pnpm exec supabase db reset
pnpm --filter @rsos/db gen:types
```
