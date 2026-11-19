import { describe, expect, it, vi } from "vitest";
import { readTourProgress, saveTourProgress, shouldAutoStart } from "../src/tours";

// A tiny stand-in for the Supabase client: only the calls tours.ts makes.
function fakeClient(rows: unknown[], sub: string | null = "u1") {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const client = {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: rows, error: null }),
      upsert,
    })),
    auth: { getClaims: vi.fn().mockResolvedValue({ data: sub ? { claims: { sub } } : null }) },
  };
  return { client: client as never, upsert };
}

describe("tour progress (RSOS-105)", () => {
  it("reads the person's tours and ignores unknown statuses", async () => {
    const { client } = fakeClient([
      { tour: "admin.owner", status: "hidden" },
      { tour: "provider.owner", status: "done" },
      { tour: "admin.page.today", status: "weird" },
    ]);
    expect(await readTourProgress(client)).toEqual({
      "admin.owner": "hidden",
      "provider.owner": "done",
    });
  });

  it("starts a tour on its own only the first time", () => {
    expect(shouldAutoStart({}, "admin.owner")).toBe(true);
    expect(shouldAutoStart({ "admin.owner": "skipped" }, "admin.owner")).toBe(false);
  });

  it("saves valid progress for the signed-in person only", async () => {
    const { client, upsert } = fakeClient([]);
    await saveTourProgress(client, { tour: "admin.owner", status: "hidden", step: 2 });
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "u1", tour: "admin.owner", status: "hidden", step: 2 },
      { onConflict: "user_id,tour" },
    );
  });

  it("ignores invalid input and signed-out people", async () => {
    const bad = fakeClient([]);
    await saveTourProgress(bad.client, { tour: "Bad Tour!", status: "done", step: 0 });
    await saveTourProgress(bad.client, { tour: "admin.owner", status: "maybe", step: 0 });
    await saveTourProgress(bad.client, { tour: "admin.owner", status: "done", step: 99 });
    expect(bad.upsert).not.toHaveBeenCalled();
    const out = fakeClient([], null);
    await saveTourProgress(out.client, { tour: "admin.owner", status: "done", step: 0 });
    expect(out.upsert).not.toHaveBeenCalled();
  });
});
