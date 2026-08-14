import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeCareerPaths } from "@/frontend/features/home/components/home-career-paths";
import type { HomeCareerPath } from "@/frontend/features/home/home-page-model";
import { careerPathSlugs } from "@/shared/contracts/jobs/career-paths";

function paths(
  overrides: Partial<Record<(typeof careerPathSlugs)[number], number | null>> = {},
): readonly HomeCareerPath[] {
  return careerPathSlugs.map((slug) => ({
    slug,
    openJobCount: Object.hasOwn(overrides, slug) ? overrides[slug]! : 3,
  }));
}

describe("Home career paths", () => {
  it("uses the Vietnamese catalog, actual count states, and filtered job destinations", () => {
    const { container } = render(
      <HomeCareerPaths
        locale="vi"
        paths={paths({
          "software-engineering": 128,
          "ui-ux-design": 0,
          "data-ai": null,
        })}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Lộ trình nghề nghiệp" }),
    ).toBeInTheDocument();
    expect(screen.getByText("128 việc làm đang mở")).toBeInTheDocument();
    expect(screen.getByText("Chưa có việc làm")).toBeInTheDocument();
    expect(
      screen.getByText("Đang cập nhật số việc làm"),
    ).toBeInTheDocument();

    for (const slug of careerPathSlugs)
      expect(
        container.querySelector(`a[href="/jobs?careerPath=${slug}"]`),
      ).toBeInTheDocument();
    expect(
      container.querySelector(".home-path-card--software-engineering"),
    ).toBeInTheDocument();
    expect(container.querySelectorAll(".home-path-icon")).toHaveLength(6);
  });
});
