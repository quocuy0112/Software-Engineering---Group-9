"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type WorkspaceLocale = "vi" | "en";

type WorkspaceLocaleContextValue = Readonly<{
  locale: WorkspaceLocale;
  setLocale: (locale: WorkspaceLocale) => void;
}>;

const WorkspaceLocaleContext = createContext<WorkspaceLocaleContextValue>({
  locale: "en",
  setLocale: () => undefined,
});

export function WorkspaceLocaleProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode;
  initialLocale?: WorkspaceLocale;
}) {
  const [locale, setLocale] = useState<WorkspaceLocale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale }), [locale]);

  return (
    <WorkspaceLocaleContext.Provider value={value}>
      {children}
    </WorkspaceLocaleContext.Provider>
  );
}

export function useWorkspaceLocale() {
  return useContext(WorkspaceLocaleContext).locale;
}

export function useSetWorkspaceLocale() {
  return useContext(WorkspaceLocaleContext).setLocale;
}
