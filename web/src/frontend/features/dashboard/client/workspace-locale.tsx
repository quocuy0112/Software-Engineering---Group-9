"use client";

import { createContext, useContext } from "react";

export type WorkspaceLocale = "vi" | "en";

export const WORKSPACE_LOCALE_UPDATED_EVENT =
  "smarthire:workspace-locale-updated";

export type WorkspaceLocaleUpdatedDetail = {
  locale: WorkspaceLocale;
};

export function notifyWorkspaceLocaleUpdated(locale: WorkspaceLocale) {
  window.dispatchEvent(
    new CustomEvent<WorkspaceLocaleUpdatedDetail>(
      WORKSPACE_LOCALE_UPDATED_EVENT,
      { detail: { locale } },
    ),
  );
}

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
