"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { createI18n, type I18n } from "./core";

const Ctx = createContext<I18n>(createI18n(DEFAULT_LOCALE));

export function I18nProvider({ locale, timeZone, children }: { locale: Locale; timeZone: string; children: React.ReactNode }) {
  const value = useMemo(() => createI18n(locale, timeZone), [locale, timeZone]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
