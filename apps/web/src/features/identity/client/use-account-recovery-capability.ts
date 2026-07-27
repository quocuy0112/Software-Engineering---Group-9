"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AccountRecoveryCapabilityKind } from "@/features/identity/schemas/password-recovery";

type CapabilityState = "authorizing" | "authorized" | "denied";

export function useAccountRecoveryCapability(
  kind: AccountRecoveryCapabilityKind,
) {
  const router = useRouter();
  const started = useRef(false);
  const [state, setState] = useState<CapabilityState>("authorizing");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const proof = new URLSearchParams(window.location.hash.slice(1)).get(
      "proof",
    );
    window.history.replaceState(null, "", window.location.pathname);

    if (!proof) {
      router.replace("/account-recovery?invalidLink=1");
      return;
    }

    void (async () => {
      try {
        const response = await fetch(
          "/api/identity/account-recovery/capability",
          {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind, proof }),
          },
        );
        if (!response.ok) throw new Error("CAPABILITY_REJECTED");
        setState("authorized");
      } catch {
        setState("denied");
        router.replace("/account-recovery?invalidLink=1");
      }
    })();
  }, [kind, router]);

  return state;
}
