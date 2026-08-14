"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { SmartHireBrand } from "@/frontend/components/ui/smarthire-brand";
import { HomeLanguageSelector } from "./home-language-selector";
import { HomeGuestActions } from "./home-guest-actions";
import { HomeAccountMenu } from "./home-account-menu";
import { HomePersonalShortcuts } from "./home-personal-shortcuts";
import { HomeMobileNavigation } from "../client/home-mobile-navigation";
import { homeCopy } from "../home-copy";
import type { HomeViewer } from "../home-page-model";
import { useHomeLocale } from "../client/home-locale-provider";

function scrollToHomeSection(event: MouseEvent<HTMLAnchorElement>) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;

  const href = event.currentTarget.getAttribute("href");
  if (!href?.startsWith("#")) return;

  const section = document.getElementById(href.slice(1));
  if (!section) return;

  event.preventDefault();

  const viewportHeight = window.innerHeight;
  const inset = Math.max(24, Math.min(56, Math.round(viewportHeight * 0.055)));
  const { top, height } = section.getBoundingClientRect();
  const currentScroll = window.scrollY || document.documentElement.scrollTop;
  const canShowWholeSection = height + inset * 2 <= viewportHeight;
  const sectionTop = canShowWholeSection
    ? currentScroll + top - (viewportHeight - height) / 2
    : currentScroll + top - inset;
  const reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  window.history.pushState(null, "", href);
  window.scrollTo({
    top: Math.max(0, sectionTop),
    behavior: reducedMotion ? "auto" : "smooth",
  });
}

export function HomeHeader({
  viewer,
  showCompanies,
}: {
  viewer: HomeViewer;
  showCompanies: boolean;
}) {
  const { locale } = useHomeLocale();
  const copy = homeCopy[locale];
  const navigation: ReadonlyArray<readonly [string, string]> = [
    ["#career-paths", copy.navigation.careerPaths],
    ["#jobs", copy.navigation.opportunities],
    ["#smart-match", copy.navigation.smartMatch],
    ["#how-it-works", copy.navigation.howItWorks],
    ["#candidate-trust", copy.navigation.candidateTrust],
    ...(showCompanies
      ? [["#companies-hiring", copy.navigation.companies] as const]
      : []),
  ];
  const links = navigation.map(([href, label]) => (
    <Link
      href={href}
      key={href}
      onClick={href.startsWith("#") ? scrollToHomeSection : undefined}
      scroll={href.startsWith("#") ? false : undefined}
    >
      {label}
    </Link>
  ));
  const accountLabels = {
    profile: copy.account.profileLabel,
    fallbackName: copy.account.memberFallback,
    logout: copy.account.logout,
    loggingOut: copy.account.loggingOut,
    logoutSuccess: copy.account.logoutSuccess,
    logoutError: copy.account.logoutError,
  };
  const desktopAccount =
    viewer.kind === "guest" ? (
      <HomeGuestActions
        login={copy.account.login}
        signup={copy.account.signup}
      />
    ) : (
      <HomeAccountMenu
        name={viewer.displayName}
        avatarUrl={viewer.avatarUrl}
        csrfProof={viewer.csrfProof}
        labels={accountLabels}
      />
    );
  return (
    <header className="home-header">
      <SmartHireBrand className="home-brand" />
      <nav className="home-desktop-links" aria-label={copy.navigation.label}>
        {links}
      </nav>
      <div className="home-header-actions">
        <HomeLanguageSelector />
        {desktopAccount}
      </div>
      <HomeMobileNavigation label={copy.navigation.mobileMenu}>
        {links}
        {viewer.kind === "guest" ? (
          <HomeGuestActions
            login={copy.account.login}
            signup={copy.account.signup}
          />
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
        )}
      </HomeMobileNavigation>
    </header>
  );
}
