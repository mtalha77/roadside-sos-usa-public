import type { AdPlatform, AdsAdapter, Conversion, SpendRow } from "./types";

/**
 * A fake ad account (RSOS-107) for tests and local runs: fixed campaigns, deterministic spend per
 * day, uploads remembered by event id (a repeat is accepted again but stored once, like the
 * platforms' own deduplication), and pause state per campaign. Nothing leaves the process.
 */
export type FakeAccount = {
  campaigns: { id: string; name: string }[];
  /** Spend in cents per campaign per day (default: 1,000 + 100 x campaign index). */
  spend?: (campaignId: string, day: string) => number;
  /** Event ids the fake refuses (to test retries). */
  reject?: Set<string>;
  failConnection?: boolean;
};

export function createFakeAds(platform: AdPlatform, account: FakeAccount) {
  const uploaded = new Map<string, Conversion>();
  const paused = new Set<string>();
  const days = (from: string, to: string) => {
    const out: string[] = [];
    for (
      let t = Date.parse(`${from}T00:00:00Z`);
      t <= Date.parse(`${to}T00:00:00Z`);
      t += 86_400_000
    )
      out.push(new Date(t).toISOString().slice(0, 10));
    return out;
  };
  const adapter: AdsAdapter & {
    uploaded: Map<string, Conversion>;
    paused: Set<string>;
    calls: { upload: number };
  } = {
    platform,
    mode: "fake",
    uploaded,
    paused,
    calls: { upload: 0 },
    async testConnection() {
      return account.failConnection
        ? { ok: false, error: "fake: authentication failed" }
        : { ok: true, accountName: `Fake ${platform} account` };
    },
    async fetchSpend(from, to) {
      const rows: SpendRow[] = [];
      for (const day of days(from, to))
        account.campaigns.forEach((c, i) => {
          const spendCents = account.spend ? account.spend(c.id, day) : 1000 + 100 * i;
          rows.push({
            day,
            campaignId: c.id,
            campaignName: c.name,
            spendCents,
            impressions: spendCents * 3,
            clicks: Math.round(spendCents / 250),
          });
        });
      return rows;
    },
    async uploadConversions(events) {
      adapter.calls.upload += 1;
      const accepted: string[] = [];
      const failed: { eventId: string; error: string }[] = [];
      for (const e of events) {
        if (account.reject?.has(e.eventId)) {
          failed.push({ eventId: e.eventId, error: "fake: rejected" });
          continue;
        }
        uploaded.set(e.eventId, e);
        accepted.push(e.eventId);
      }
      return { accepted, failed, response: { fake: true, received: events.length } };
    },
    async setCampaignsPaused(ids, pause) {
      const changed = ids.filter((id) => paused.has(id) !== pause);
      for (const id of changed) {
        if (pause) paused.add(id);
        else paused.delete(id);
      }
      return { changed };
    },
  };
  return adapter;
}
