import { appUrl } from "@rsos/config/site";
import { Alert } from "@rsos/ui/alert";
import { Badge } from "@rsos/ui/badge";
import { Button } from "@rsos/ui/button";
import { inputClass } from "@rsos/ui/input";
import { getTranslations } from "next-intl/server";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  addTestDeviceAction,
  addTestIpAction,
  removeTestRuleAction,
} from "@/lib/test-traffic-actions";

const label = "flex flex-col gap-1.5 text-sm font-medium";

/**
 * Settings > System > Test traffic (owner decision 2): the IPs and devices whose website visits are
 * test traffic. Also test traffic, in every environment: a session started with `?rsos_test=1` and
 * any browser where staff are signed in to the admin.
 */
export async function TestTraffic({ sp }: { sp: Record<string, string | undefined> }) {
  const t = await getTranslations("admin.testTraffic");
  const { data: rules } = await (
    await getServerSupabase()
  )
    .from("test_traffic_rules")
    .select("id, kind, value, label, created_at")
    .order("created_at", { ascending: false });
  const device =
    sp.tt === "device" && /^[A-Za-z0-9_-]{24,64}$/.test(sp.device ?? "") ? sp.device : null;
  const link = device ? `${appUrl("web")}/?rsos_test=${device}` : null;
  return (
    <section id="test-traffic" className="rounded-2xl border bg-card p-4" aria-labelledby="tt-h">
      <h3 id="tt-h" className="mb-1 font-semibold">
        {t("title")}
      </h3>
      <p className="mb-3 text-sm text-muted-foreground">{t("note")}</p>
      {sp.tt === "added" || sp.tt === "removed" ? <Alert tone="success" title={t(sp.tt)} /> : null}
      {sp.tt === "invalid" || sp.tt === "forbidden" ? (
        <Alert tone="critical" title={t(sp.tt)} />
      ) : null}
      {link ? (
        <Alert tone="success" title={t("deviceAdded")}>
          <p className="break-all font-mono text-sm">{link}</p>
        </Alert>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <form action={addTestIpAction} className="flex flex-col gap-2 rounded-xl border p-3">
          <h4 className="font-medium">{t("addIp")}</h4>
          <label className={label}>
            {t("ip")}
            <input name="ip" required maxLength={60} className={inputClass} />
          </label>
          <label className={label}>
            {t("label")}
            <input name="label" required maxLength={80} className={inputClass} />
          </label>
          <Button type="submit" variant="outline" className="self-start">
            {t("add")}
          </Button>
        </form>
        <form action={addTestDeviceAction} className="flex flex-col gap-2 rounded-xl border p-3">
          <h4 className="font-medium">{t("addDevice")}</h4>
          <p className="text-sm text-muted-foreground">{t("deviceHow")}</p>
          <label className={label}>
            {t("label")}
            <input name="label" required maxLength={80} className={inputClass} />
          </label>
          <Button type="submit" variant="outline" className="self-start">
            {t("createLink")}
          </Button>
        </form>
      </div>
      <h4 className="mt-4 mb-2 text-sm font-semibold">{t("list")}</h4>
      {(rules ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y text-sm">
          {(rules ?? []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="flex items-center gap-2">
                <Badge tone="neutral">{t(r.kind === "ip" ? "kindIp" : "kindDevice")}</Badge>
                <span className="font-medium">{r.label}</span>
                {r.kind === "ip" ? (
                  <span className="font-mono text-muted-foreground">{r.value}</span>
                ) : null}
              </span>
              <form action={removeTestRuleAction}>
                <input type="hidden" name="id" value={r.id} />
                <Button type="submit" variant="outline">
                  {t("remove")}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
