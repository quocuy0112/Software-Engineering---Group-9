"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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
const homeLocaleStorageKey = "smarthire.home.locale";

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
    const stored = window.localStorage.getItem(homeLocaleStorageKey);
    if (stored === "vi" || stored === "en") setLocale(stored);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(homeLocaleStorageKey, locale);
  }, [locale]);
  const updateLocale = useCallback((nextLocale: HomeLocale) => {
    setLocale(nextLocale);
  }, []);
  const value = useMemo(
    () => ({ locale, setLocale: updateLocale, searchDraft, setSearchDraft }),
    [locale, searchDraft, updateLocale],
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
