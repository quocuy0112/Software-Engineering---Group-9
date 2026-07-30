"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AuthFooter() {
  const pathname = usePathname();
  const isRegisterPage = pathname === "/register";

  return (
    <footer className="auth-footer">
      <span>
        {isRegisterPage
          ? "Already have an account?"
          : "Don't have an account yet?"}
      </span>

      <Link href={isRegisterPage ? "/login" : "/register"}>
        {isRegisterPage ? "Sign In" : "Sign Up"}
      </Link>
    </footer>
  );
}
