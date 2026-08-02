"use client";

import { createContext, useContext } from "react";

export type WorkspaceLocale = "vi" | "en";

const WorkspaceLocaleContext = createContext<WorkspaceLocale>("en");

export function WorkspaceLocaleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceLocaleContext.Provider value="en">
      {children}
    </WorkspaceLocaleContext.Provider>
  );
}

export function useWorkspaceLocale() {
  return useContext(WorkspaceLocaleContext);
}
