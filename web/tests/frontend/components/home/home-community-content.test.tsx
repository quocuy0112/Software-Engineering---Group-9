import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeWhatsNew } from "@/frontend/features/home/components/home-whats-new";
import { HomeCareerPaths } from "@/frontend/features/home/components/home-career-paths";
import { HomeGrowthHub } from "@/frontend/features/home/components/home-growth-hub";
import { HomeCareerEvents } from "@/frontend/features/home/components/home-career-events";

describe("Home curated community content", () => {
  it.each(["en", "vi"] as const)("is bounded, bilingual, plausible, and display-only in %s", (locale) => {
    const { container } = render(
      <>
        <HomeWhatsNew locale={locale} />
        <HomeCareerPaths locale={locale} />
        <HomeGrowthHub locale={locale} />
        <HomeCareerEvents locale={locale} />
      </>,
    );
    expect(container.querySelectorAll(".home-feed-card")).toHaveLength(3);
    expect(container.querySelectorAll(".home-path-grid article")).toHaveLength(6);
    expect(container.querySelectorAll(".home-growth-grid article")).toHaveLength(4);
    expect(container.querySelectorAll(".home-events-grid article")).toHaveLength(4);
    expect(screen.getAllByText(locale === "en" ? "Display only" : "Chỉ hiển thị")).toHaveLength(17);
    expect(within(container).queryByRole("link")).not.toBeInTheDocument();
    expect(within(container).queryByRole("button")).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/like|comment|register now|live now/iu);
  });
});
