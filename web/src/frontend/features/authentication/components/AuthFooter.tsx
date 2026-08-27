"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { authCopy } from "./auth-copy";

export default function AuthFooter() {
  const pathname = usePathname();
  const copy = authCopy(useWorkspaceLocale()).footer;
  const isRegisterPage = pathname === "/register";

  return (
    <footer className="auth-footer">
      <span>
        {isRegisterPage ? copy.haveAccount : copy.needAccount}
      </span>

      <Link href={isRegisterPage ? "/login" : "/register"}>
        {isRegisterPage ? copy.signIn : copy.signUp}
      </Link>
    </footer>
  );
}
