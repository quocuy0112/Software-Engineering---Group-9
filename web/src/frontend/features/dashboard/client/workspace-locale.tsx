"use client";

import { createContext, useContext } from "react";

export type WorkspaceLocale = "vi" | "en";

const WorkspaceLocaleContext = createContext<WorkspaceLocale>("en");

export function WorkspaceLocaleProvider({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: WorkspaceLocale;
}) {
  return (
    <WorkspaceLocaleContext.Provider value={locale}>
      {children}
    </WorkspaceLocaleContext.Provider>
  );
}

export function useWorkspaceLocale() {
  return useContext(WorkspaceLocaleContext);
}
