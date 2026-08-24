"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  FileCheck2,
  Info,
  LifeBuoy,
  LockKeyhole,
  ShieldCheck,
  UserRoundX,
  type LucideIcon,
} from "lucide-react";
import { HomeLocaleProvider, useHomeLocale } from "../client/home-locale-provider";
import { homeCopy } from "../home-copy";
import { HomeLanguageSelector } from "./home-language-selector";

const policyVersion = "2026-08-05";

const principleIcons: Record<
  "optional" | "human" | "integrity",
  LucideIcon
> = {
  optional: CheckCircle2,
  human: ShieldCheck,
  integrity: LockKeyhole,
};

function PolicyContent() {
  const { locale } = useHomeLocale();
  const copy = homeCopy[locale].aiCvPolicy;
  const year = new Date().getFullYear();

  return (
    <main className="home-policy-page">
      <div className="home-policy-shell">
        <nav className="home-policy-nav" aria-label={copy.backToHome}>
          <Link className="home-policy-back" href="/">
            <ArrowLeft aria-hidden="true" />
            <span>{copy.backToHome}</span>
          </Link>
          <div className="home-policy-nav-actions">
            <HomeLanguageSelector />
            <span className="home-policy-version">
              <CalendarDays aria-hidden="true" />
              {copy.effective}: <strong>{policyVersion}</strong>
            </span>
          </div>
        </nav>

        <article className="home-policy-hero">
          <div className="home-policy-eyebrow">
            <span aria-hidden="true" />
            {copy.eyebrow}
          </div>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>

          <div className="home-policy-principles">
            {copy.principles.map((principle) => {
              const Icon = principleIcons[principle.key];
              return (
                <section
                  className={`home-policy-principle home-policy-principle--${principle.key}`}
                  key={principle.key}
                >
                  <Icon aria-hidden="true" />
                  <div>
                    <h2>{principle.title}</h2>
                    <p>{principle.body}</p>
                  </div>
                </section>
              );
            })}
          </div>
        </article>

        <div className="home-policy-sections">
          {copy.sections.map((section, index) => (
            <section className="home-policy-section" key={section.title}>
              <div className="home-policy-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="home-policy-section-content">
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}

                {index === 0 ? (
                  <aside className="home-policy-notice">
                    <Info aria-hidden="true" />
                    <p>
                      <strong>{copy.importantNoticeLabel}:</strong>{" "}
                      {copy.importantNotice}
                    </p>
                  </aside>
                ) : null}

                {index === 2 ? (
                  <div className="home-policy-highlights">
                    <span>
                      <FileCheck2 aria-hidden="true" />
                      {copy.dataHighlights[0]}
                    </span>
                    <span>
                      <UserRoundX aria-hidden="true" />
                      {copy.dataHighlights[1]}
                    </span>
                  </div>
                ) : null}

                {index === 3 ? (
                  <Link className="home-policy-support" href="/help">
                    <LifeBuoy aria-hidden="true" />
                    <span>{copy.supportAction}</span>
                    <ArrowUpRight aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            </section>
          ))}
        </div>

        <footer className="home-policy-footer">
          <p>{copy.copyright.replace("{year}", String(year))}</p>
          <p>
            {copy.policyVersion}: <strong>{policyVersion}</strong>
            <BadgeCheck aria-hidden="true" />
          </p>
        </footer>
      </div>
    </main>
  );
}

export function HomeAiCvPolicyPage() {
  return (
    <HomeLocaleProvider initialLocale="vi">
      <PolicyContent />
    </HomeLocaleProvider>
  );
}
