import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (["node_modules", ".next", ".turbo", "dist", "coverage"].includes(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|mjs)$/.test(name) ? [path] : [];
  });
}

const files = [...sourceFiles(join(ROOT, "apps")), ...sourceFiles(join(ROOT, "packages"))].map(
  (path) => ({
    path: relative(ROOT, path),
    content: readFileSync(path, "utf8"),
  }),
);

describe("Supabase service role key stays on the server", () => {
  it("the admin client module is marked server-only", () => {
    const admin = files.find((f) => f.path === "packages/db/src/admin.ts");
    expect(admin?.content).toMatch(/^import "server-only";/m);
  });

  it("no client component imports the admin client or reads the key", () => {
    const offenders = files.filter(
      (f) =>
        /^["']use client["']/m.test(f.content) &&
        (f.content.includes("@rsos/db/admin") || f.content.includes("SUPABASE_SERVICE_ROLE_KEY")),
    );
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it("the key is never exposed with a NEXT_PUBLIC_ prefix", () => {
    const offenders = files.filter((f) => /NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE/.test(f.content));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it("only @rsos/db/admin reads the key", () => {
    const readers = files
      .filter((f) => !f.path.includes("/test/") && f.content.includes("SUPABASE_SERVICE_ROLE_KEY"))
      .map((f) => f.path);
    expect(readers.sort()).toEqual(["packages/db/src/admin.ts", "packages/db/src/env.ts"]);
  });
});
