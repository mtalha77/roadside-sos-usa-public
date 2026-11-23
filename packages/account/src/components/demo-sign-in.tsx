import { isDemoMode } from "@rsos/config/demo";
import { Button } from "@rsos/ui/button";
import { getTranslations } from "next-intl/server";
import { demoSignInAction } from "../server/demo";
import type { DemoRole } from "../server/demo-roles";

/** "Sign in as demo" buttons; renders nothing outside demo mode (never in production). */
export async function DemoSignIn({ roles }: { roles: DemoRole[] }) {
  if (!isDemoMode()) return null;
  const t = await getTranslations("demo");
  return (
    <section
      aria-labelledby="demo-sign-in"
      className="flex flex-col gap-3 rounded-xl border border-dashed p-4"
    >
      <h3 id="demo-sign-in" className="font-semibold">
        {t("signInTitle")}
      </h3>
      <p className="text-sm text-muted-foreground">{t("signInBody")}</p>
      <div className="flex flex-wrap gap-2">
        {roles.map((r) => (
          <form key={r} action={demoSignInAction}>
            <input type="hidden" name="role" value={r} />
            <Button type="submit" variant="outline" size="sm">
              {t(`roles.${r}`)}
            </Button>
          </form>
        ))}
      </div>
    </section>
  );
}
