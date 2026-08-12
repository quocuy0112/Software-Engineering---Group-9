"use client";

import Link from "next/link";
import { SmartHireBrand } from "@/frontend/components/ui/smarthire-brand";
import { HomeLanguageSelector } from "./home-language-selector";
import { HomeGuestActions } from "./home-guest-actions";
import { HomeAccountMenu } from "./home-account-menu";
import { HomePersonalShortcuts } from "./home-personal-shortcuts";
import { HomeMobileNavigation } from "../client/home-mobile-navigation";
import { homeCopy } from "../home-copy";
import type { HomeViewer } from "../home-page-model";
import { useHomeLocale } from "../client/home-locale-provider";

export function HomeHeader({ viewer }: { viewer: HomeViewer }) {
  const { locale } = useHomeLocale();
  const copy = homeCopy[locale];
  const navigation = [
    ["/jobs", copy.navigation.exploreJobs],
    ["#community", copy.navigation.community],
    ["#employer-spotlight", copy.navigation.companies],
    ["#events", copy.navigation.events],
  ] as const;
  const links = navigation.map(([href, label]) => (
    <Link href={href} key={href}>{label}</Link>
  ));
  const accountLabels = {
    profile: copy.account.profileLabel,
    fallbackName: copy.account.memberFallback,
    logout: copy.account.logout,
    loggingOut: copy.account.loggingOut,
    logoutSuccess: copy.account.logoutSuccess,
    logoutError: copy.account.logoutError,
  };
  const account =
    viewer.kind === "guest" ? (
      <HomeGuestActions login={copy.account.login} signup={copy.account.signup} />
    ) : (
      <>
        <HomeAccountMenu
          name={viewer.displayName}
          avatarUrl={viewer.avatarUrl}
          csrfProof={viewer.csrfProof}
          labels={accountLabels}
        />
        <HomePersonalShortcuts viewer={viewer} copy={copy} />
      </>
    );
  return (
    <header className="home-header">
      <SmartHireBrand className="home-brand" />
      <nav className="home-desktop-links" aria-label={copy.navigation.label}>
        {links}
      </nav>
      <div className="home-header-actions">
        <HomeLanguageSelector />
        {account}
      </div>
      <HomeMobileNavigation label={copy.navigation.mobileMenu}>
        {links}
        {account}
      </HomeMobileNavigation>
    </header>
  );
}
