import { defaultLocale, getMessages } from "@rsos/i18n";
import { getRequestConfig } from "next-intl/server";

// English only for now. Spanish is ready in @rsos/i18n; locale routing comes with its own ticket.
export default getRequestConfig(async () => ({
  locale: defaultLocale,
  messages: getMessages(defaultLocale),
}));
