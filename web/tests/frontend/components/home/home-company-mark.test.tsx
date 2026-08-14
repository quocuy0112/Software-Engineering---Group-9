import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeCompanyMark } from "@/frontend/features/home/components/home-company-mark";

describe("Home company mark", () => {
  it("uses a monogram while a company logo is missing or cannot be verified", () => {
    const { container } = render(
      <HomeCompanyMark
        name="Unity Trading Co."
        logoUrl="https://invalid.example.test/logo.png"
      />,
    );

    expect(screen.getByText("UT")).toHaveClass("home-job-company-mark");
    expect(container.querySelector("img")).toBeNull();
  });
});
