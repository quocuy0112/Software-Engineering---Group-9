import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomePublicSupportPage } from "@/frontend/features/home/components/home-public-support-page";

describe("HomePublicSupportPage", () => {
  it("keeps the FAQ public while directing private requests through sign in", () => {
    const { container } = render(<HomePublicSupportPage />);

    expect(
      container.querySelector(".home-public-support-back"),
    ).toHaveAttribute("href", "/");
    expect(container.querySelector(".home-language select")).toBeInTheDocument();
    expect(container.querySelector(".support-faq")).toBeInTheDocument();
    expect(
      container.querySelector(".support-help__bridge a"),
    ).toHaveAttribute("href", "/login?returnTo=%2Fsupport");
  });
});
