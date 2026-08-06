"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

export const jobDetailAnchors = [
  { id: "description", label: "Job Description" },
  { id: "requirements", label: "Requirements" },
  { id: "benefits", label: "Benefits" },
  { id: "company", label: "Company" },
] as const;

export function StickyMiniNav({
  onApply,
  applyOpen = false,
  applyDisabled = false,
  applyHref,
}: {
  onApply?: () => void;
  applyOpen?: boolean;
  applyDisabled?: boolean;
  applyHref?: string;
}) {
  const [activeId, setActiveId] =
    useState<(typeof jobDetailAnchors)[number]["id"]>("description");
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const rootCandidate =
      document.querySelector<HTMLElement>(".workspace-main");
    const rootOverflow = rootCandidate
      ? window.getComputedStyle(rootCandidate).overflowY
      : "";
    const root =
      rootCandidate && ["auto", "overlay", "scroll"].includes(rootOverflow)
        ? rootCandidate
        : null;
    const companyIsStickySidebar = Boolean(
      document.querySelector<HTMLElement>(
        '[data-job-detail-sidebar="true"] [data-job-sidebar-company="true"]',
      ),
    );
    const isMobileViewport =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 980px)").matches;
    const trackCompany = !companyIsStickySidebar || isMobileViewport;
    const sections = jobDetailAnchors
      .filter((anchor) => anchor.id !== "company" || trackCompany)
      .map(({ id }) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));

    if (!sections.length) return;

    const updateActiveSection = () => {
      const rootTop = root?.getBoundingClientRect().top ?? 0;
      const header = document.querySelector<HTMLElement>(
        "[data-job-detail-sticky-header]",
      );
      const headerHeight = header?.getBoundingClientRect().height ?? 0;
      navRef.current?.style.setProperty(
        "--job-detail-header-height",
        String(headerHeight) + "px",
      );
      const navHeight = navRef.current?.getBoundingClientRect().height ?? 0;
      const marker = rootTop + Math.max(120, headerHeight + navHeight / 2);
      let current = sections[0].id;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= marker) current = section.id;
      }
      setActiveId(current as (typeof jobDetailAnchors)[number]["id"]);
    };

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(() => updateActiveSection(), {
            root,
            rootMargin: "-120px 0px -60% 0px",
            threshold: [0, 0.15, 0.5],
          });

    sections.forEach((section) => observer?.observe(section));
    const scrollTarget: HTMLElement | Window = root ?? window;
    scrollTarget.addEventListener("scroll", updateActiveSection, {
      passive: true,
    });
    window.addEventListener("resize", updateActiveSection);
    updateActiveSection();

    return () => {
      observer?.disconnect();
      scrollTarget.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, []);

  function scrollToSection(
    event: MouseEvent<HTMLButtonElement>,
    id: (typeof jobDetailAnchors)[number]["id"],
  ) {
    event.preventDefault();
    setActiveId(id);
    const target = document.getElementById(id);
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
    window.history.replaceState(null, "", "#" + id);
  }

  return (
    <nav
      ref={navRef}
      className="job-sticky-mini-nav"
      aria-label="Job detail sections"
    >
      <div className="job-sticky-mini-nav-links">
        {jobDetailAnchors.map((anchor) => (
          <button
            key={anchor.id}
            type="button"
            aria-current={activeId === anchor.id ? "location" : undefined}
            className={activeId === anchor.id ? "is-active" : undefined}
            onClick={(event) => scrollToSection(event, anchor.id)}
          >
            {anchor.label}
          </button>
        ))}
      </div>
      {applyHref ? (
        <a className="job-mini-nav-apply" href={applyHref}>
          Sign in to apply
        </a>
      ) : onApply ? (
        <button
          type="button"
          className="job-mini-nav-apply"
          aria-controls="apply"
          aria-expanded={applyOpen}
          disabled={applyDisabled}
          onClick={onApply}
        >
          {applyOpen ? "Hide application form" : "Apply now"}
        </button>
      ) : null}
    </nav>
  );
}
