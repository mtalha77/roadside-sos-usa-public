# supabase/

Cloud only: there is no local database. CI applies migrations to the cloud projects
(`rsos-dev` on pull requests, `rsos-staging` on merge to `staging`, `rsos-prod` on merge to `main`).

| Path          | What goes here                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `config.toml` | CLI configuration. Not pushed to the cloud projects.                                                                           |
| `migrations/` | SQL migrations, one per change, created by `pnpm exec supabase migration new <name>`. Tables enable RLS in the same migration. |
| `tests/`      | pgTAP tests (`*.test.sql`), run by CI with `supabase test db --remote` after each migration run.                               |
| `seed.sql`    | Test data. Not applied to cloud projects automatically.                                                                        |
| `functions/`  | Edge Functions (Deno). One folder per function.                                                                                |

Never change the schema in the Supabase dashboard. See CLAUDE.md, rule 4a.
