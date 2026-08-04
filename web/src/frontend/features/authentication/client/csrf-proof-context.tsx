"use client";

import { createContext, useContext } from "react";

const CsrfProofContext = createContext("");

export function CsrfProofProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: string;
}) {
  return (
    <CsrfProofContext.Provider value={value}>
      {children}
    </CsrfProofContext.Provider>
  );
}

export function useCsrfProof() {
  return useContext(CsrfProofContext);
}
