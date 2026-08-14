"use client";
import { useEffect, type ReactNode } from "react";
import { useAuthProvider, useLogout } from "react-admin";
import { createAdminQueryClient } from "../app/query-client";

export function AdminAuthorityGate({ children }: { children: ReactNode }) {
  const auth = useAuthProvider();
  const logout = useLogout();
  useEffect(() => {
    if (!auth) return;
    let disposed = false;
    let validationPending = false;
    const validate = () => {
      if (validationPending) return;
      validationPending = true;
      void auth
        .checkAuth({})
        .catch(async () => {
          if (disposed) return;
          createAdminQueryClient().clear();
          await logout(undefined, "/login").catch(() => undefined);
        })
        .finally(() => {
          validationPending = false;
        });
    };
    validate();
    window.addEventListener("popstate", validate);
    window.addEventListener("focus", validate);
    return () => {
      disposed = true;
      window.removeEventListener("popstate", validate);
      window.removeEventListener("focus", validate);
    };
  }, [auth, logout]);
  return children;
}
