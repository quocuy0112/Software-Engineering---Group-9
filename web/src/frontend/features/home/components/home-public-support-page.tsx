"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SupportFaq } from "@/frontend/features/support/components/support-faq";
import {
  HomeLocaleProvider,
  useHomeLocale,
} from "../client/home-locale-provider";
import { homeCopy } from "../home-copy";
import { HomeLanguageSelector } from "./home-language-selector";

const privateSupportReturnTo = "/login?returnTo=%2Fsupport";

function PublicSupportContent() {
  const { locale } = useHomeLocale();
  const copy = homeCopy[locale].aiCvPolicy;

  return (
    <main className="home-public-support-page">
      <div className="home-public-support-shell">
        <nav
          className="home-public-support-utility"
          aria-label={copy.backToHome}
        >
          <Link className="home-public-support-back" href="/">
            <ArrowLeft aria-hidden="true" />
            <span>{copy.backToHome}</span>
          </Link>
          <HomeLanguageSelector />
        </nav>

        <SupportFaq
          locale={locale}
          supportRequestHref={privateSupportReturnTo}
        />
      </div>
    </main>
  );
}

/**
 * A public, read-only entry point to the same FAQ used inside Support Center.
 * Private cases remain available only in the authenticated /support workspace.
 */
export function HomePublicSupportPage() {
  return (
    <HomeLocaleProvider initialLocale="vi">
      <PublicSupportContent />
    </HomeLocaleProvider>
  );
}
