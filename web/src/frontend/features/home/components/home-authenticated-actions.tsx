"use client";

import { useHomeLocale } from "../client/home-locale-provider";
import { homeCopy } from "../home-copy";
import { HomeAccountMenu } from "./home-account-menu";

export function HomeAuthenticatedActions({
  profile,
  csrfProof,
}: {
  profile: { name: string; email: string; image?: string | null };
  csrfProof: string;
}) {
  const { locale } = useHomeLocale();
  const copy = homeCopy[locale];
  return (
    <HomeAccountMenu
      name={profile.name}
      avatarUrl={profile.image ?? null}
      csrfProof={csrfProof}
      labels={{
        profile: copy.account.profileLabel,
        fallbackName: copy.account.memberFallback,
        logout: copy.account.logout,
        loggingOut: copy.account.loggingOut,
        logoutSuccess: copy.account.logoutSuccess,
        logoutError: copy.account.logoutError,
      }}
    />
  );
}
