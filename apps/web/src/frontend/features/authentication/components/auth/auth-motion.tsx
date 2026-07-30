"use client";

import { usePathname } from "next/navigation";

export function AuthMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="auth-motion" data-route={pathname}>
      {children}
    </div>
  );
}
