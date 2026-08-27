"use client";

import { ExternalLink, Mail, MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { authCopy, localizedAuthMessage } from "./auth-copy";

const FALLBACK_EMAIL = "candidate@example.com";
const RESEND_COOLDOWN_SECONDS = 60;

const emailProviders: Record<string, { name: string; url: string }> = {
  "gmail.com": { name: "Gmail", url: "https://mail.google.com" },
  "googlemail.com": { name: "Gmail", url: "https://mail.google.com" },
  "outlook.com": { name: "Outlook", url: "https://outlook.live.com" },
  "hotmail.com": { name: "Outlook", url: "https://outlook.live.com" },
  "live.com": { name: "Outlook", url: "https://outlook.live.com" },
  "yahoo.com": { name: "Yahoo Mail", url: "https://mail.yahoo.com" },
  "myyahoo.com": { name: "Yahoo Mail", url: "https://mail.yahoo.com" },
  "icloud.com": { name: "iCloud Mail", url: "https://www.icloud.com/mail" },
  "me.com": { name: "iCloud Mail", url: "https://www.icloud.com/mail" },
  "mac.com": { name: "iCloud Mail", url: "https://www.icloud.com/mail" },
  "zoho.com": { name: "Zoho Mail", url: "https://mail.zoho.com" },
  "proton.me": { name: "Proton Mail", url: "https://mail.proton.me" },
  "protonmail.com": { name: "Proton Mail", url: "https://mail.proton.me" },
};

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function providerFor(email: string) {
  return emailProviders[email.split("@")[1]?.toLowerCase() ?? ""];
}

export function CheckEmailView() {
  const locale = useWorkspaceLocale();
  const copy = authCopy(locale);
  const searchParams = useSearchParams();
  const storedEmail = useSyncExternalStore(
    () => () => undefined,
    () => sessionStorage.getItem("pending_verification_email") ?? "",
    () => "",
  );
  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (cooldown === 0) return;
    const timer = window.setInterval(() => {
      setCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const email = useMemo(() => {
    const queryEmail = searchParams.get("email")?.trim().toLowerCase() ?? "";
    if (isEmail(queryEmail)) return queryEmail;
    if (isEmail(storedEmail)) return storedEmail;
    return FALLBACK_EMAIL;
  }, [searchParams, storedEmail]);
  const provider = providerFor(email);

  function openInbox() {
    if (provider) {
      window.open(provider.url, "_blank", "noopener,noreferrer");
      return;
    }
    window.location.assign(`mailto:${encodeURIComponent(email)}`);
  }

  async function resend() {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);
    try {
      const response = await fetch("/api/identity/verification/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) throw new Error(result?.message);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success(
        localizedAuthMessage(locale, result?.message, copy.checkEmail.sent),
      );
    } catch {
      toast.error(copy.checkEmail.resendError);
    } finally {
      setIsResending(false);
    }
  }

  return (
    <section className="check-email-view" aria-labelledby="check-email-title">
      <div className="check-email-icon" aria-hidden="true">
        <MailCheck size={28} strokeWidth={2.2} />
      </div>
      <div className="check-email-copy">
        <h1 id="check-email-title">{copy.checkEmail.title}</h1>
        <p>{copy.checkEmail.description}</p>
        <span className="check-email-address">
          <Mail size={15} aria-hidden="true" />
          {email}
        </span>
      </div>
      <button
        className="check-email-inbox-button"
        type="button"
        onClick={openInbox}
      >
        <ExternalLink size={17} aria-hidden="true" />
        {provider
          ? copy.checkEmail.openProvider(provider.name)
          : copy.checkEmail.openInbox}
      </button>
      <button
        className="check-email-resend"
        type="button"
        onClick={resend}
        disabled={cooldown > 0 || isResending}
      >
        {isResending ? (
          copy.checkEmail.resending
        ) : cooldown > 0 ? (
          copy.checkEmail.resendAvailable(cooldown)
        ) : (
          <>
            {copy.checkEmail.didNotReceive} {" "}
            <span>{copy.checkEmail.clickToResend}</span>
          </>
        )}
      </button>
      <div className="check-email-sign-in">
        <span>{copy.checkEmail.haveAccount}</span>
        <Link href="/login">{copy.checkEmail.signIn}</Link>
      </div>
    </section>
  );
}
