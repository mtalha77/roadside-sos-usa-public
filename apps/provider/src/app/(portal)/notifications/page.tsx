import { getTranslations } from "next-intl/server";
import { NotificationSettings } from "@/components/support/notification-settings";
import { PageHead, pageMain } from "@/components/shell/page-head";

/** Notification settings (RSOS-062): alert channels, sound, test alert and quiet hours. */
export default async function NotificationsPage() {
  const t = await getTranslations("portal.notifications");
  const keys = [
    "channels",
    "push",
    "pushHint",
    "sms",
    "smsHint",
    "voice",
    "voiceHint",
    "sound",
    "test",
    "testSent",
    "quiet",
    "quietHint",
    "from",
    "to",
    "save",
    "saved",
  ] as const;
  return (
    <main id="main" className={pageMain}>
      <PageHead title={t("title")} subtitle={t("subtitle")} />
      <NotificationSettings
        labels={Object.fromEntries(keys.map((k) => [k, t(k)]))}
        sounds={(["siren", "chime", "horn"] as const).map((s) => ({
          id: s,
          label: t(`sounds.${s}`),
        }))}
      />
    </main>
  );
}
