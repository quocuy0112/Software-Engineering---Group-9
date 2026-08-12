"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { HomeLocale } from "../home-page-model";
import {
  emptyHomeSearchDraft,
  type HomeSearchDraft,
} from "../home-search-config";

type HomeLocaleValue = {
  locale: HomeLocale;
  setLocale: (locale: HomeLocale) => void;
  searchDraft: HomeSearchDraft;
  setSearchDraft: (draft: HomeSearchDraft) => void;
};
const HomeLocaleContext = createContext<HomeLocaleValue>({
  locale: "vi",
  setLocale: () => undefined,
  searchDraft: emptyHomeSearchDraft,
  setSearchDraft: () => undefined,
});

export function HomeLocaleProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: HomeLocale;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [searchDraft, setSearchDraft] = useState<HomeSearchDraft>(
    emptyHomeSearchDraft,
  );
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const value = useMemo(
    () => ({ locale, setLocale, searchDraft, setSearchDraft }),
    [locale, searchDraft],
  );
  return (
    <HomeLocaleContext.Provider value={value}>
      {children}
    </HomeLocaleContext.Provider>
  );
}

export function useHomeLocale() {
  return useContext(HomeLocaleContext);
}
