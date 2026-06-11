import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./locales/en/common.json";
import enChat from "./locales/en/chat.json";
import enSettings from "./locales/en/settings.json";
import enUsage from "./locales/en/usage.json";
import enPlugins from "./locales/en/plugins.json";
import enAutomations from "./locales/en/automations.json";
import enDailyReview from "./locales/en/daily-review.json";
import enSavedAgents from "./locales/en/saved-agents.json";

import zhCommon from "./locales/zh/common.json";
import zhChat from "./locales/zh/chat.json";
import zhSettings from "./locales/zh/settings.json";
import zhUsage from "./locales/zh/usage.json";
import zhPlugins from "./locales/zh/plugins.json";
import zhAutomations from "./locales/zh/automations.json";
import zhDailyReview from "./locales/zh/daily-review.json";
import zhSavedAgents from "./locales/zh/saved-agents.json";

function detectInitialLanguage(): "en" | "zh" {
  if (typeof window === "undefined") return "en";

  try {
    const stored = window.localStorage.getItem("openyak-language");
    if (stored === "en" || stored === "zh") return stored;
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }

  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      chat: enChat,
      settings: enSettings,
      usage: enUsage,
      plugins: enPlugins,
      automations: enAutomations,
      "daily-review": enDailyReview,
      "saved-agents": enSavedAgents,
    },
    zh: {
      common: zhCommon,
      chat: zhChat,
      settings: zhSettings,
      usage: zhUsage,
      plugins: zhPlugins,
      automations: zhAutomations,
      "daily-review": zhDailyReview,
      "saved-agents": zhSavedAgents,
    },
  },
  fallbackLng: "en",
  lng: detectInitialLanguage(),
  defaultNS: "common",
  ns: ["common", "chat", "settings", "usage", "plugins", "automations", "daily-review", "saved-agents"],
  interpolation: {
    escapeValue: false,
  },
});

export function getClientLanguagePreference(): "en" | "zh" {
  return detectInitialLanguage();
}

export default i18n;
