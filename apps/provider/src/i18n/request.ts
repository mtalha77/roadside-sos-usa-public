import { getMessages, LOCALE_COOKIE, resolveLocale } from "@rsos/i18n";
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

// English is the default; Spanish is chosen with the NEXT_LOCALE cookie (language switcher).
export default getRequestConfig(async () => {
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return { locale, messages: getMessages(locale) };
});
