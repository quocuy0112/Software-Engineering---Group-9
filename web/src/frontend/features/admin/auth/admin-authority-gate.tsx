"use client";
import { useEffect, type ReactNode } from "react";
import { useAuthProvider, useLogout } from "react-admin";
import { createAdminQueryClient } from "../app/query-client";

export function AdminAuthorityGate({ children }: { children: ReactNode }) {
  const auth = useAuthProvider();
  const logout = useLogout();
  useEffect(() => {
    if (!auth) return;
    const validate = () => {
      void auth.checkAuth({}).catch(async () => {
        createAdminQueryClient().clear();
        await logout(undefined, "/login");
      });
    };
    validate();
    window.addEventListener("popstate", validate);
    window.addEventListener("focus", validate);
    return () => {
      window.removeEventListener("popstate", validate);
      window.removeEventListener("focus", validate);
    };
  }, [auth, logout]);
  return children;
}
