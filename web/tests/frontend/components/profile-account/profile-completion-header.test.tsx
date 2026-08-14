import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  getProfileCompletion,
  ProfileCompletionHeader,
} from "@/frontend/features/profile/components/profile-completion-header";

const emptyProfile = {
  revision: 0,
  empty: true,
  basics: { headline: null, summary: null, phone: null, location: null },
  skills: [],
  experience: [],
  education: [],
  socialLinks: [],
};

describe("profile completion header", () => {
  it("calculates each completion state from meaningful saved profile data", () => {
    const completion = getProfileCompletion(
      {
        ...emptyProfile,
        basics: {
          headline: "Platform engineer",
          summary: "Builds reliable systems.",
          phone: null,
          location: null,
        },
        skills: [{ id: "skill-1", label: "TypeScript" }],
        experience: [
          {
            id: "experience-1",
            title: "Engineer",
            company: "Smart Hire",
            description: null,
            startDate: "2024-01-01",
            endDate: null,
            current: true,
          },
        ],
        education: [
          {
            id: "education-1",
            institution: "HCMUS",
            degree: "Bachelor",
            field: null,
            startDate: "2020-01-01",
            endDate: null,
            current: true,
          },
        ],
        socialLinks: [{ id: "link-1", url: "https://github.com/example" }],
      },
      "https://example.com/avatar.png",
    );

    expect(completion.completed).toBe(6);
    expect(completion.percentage).toBe(100);
  });

  it("exposes the real completion percentage and clear chip states", () => {
    render(
      <ProfileCompletionHeader
        profile={emptyProfile}
        avatar={null}
        locale="en"
      />,
    );

    expect(
      screen.getByRole("progressbar", { name: "Profile completion" }),
    ).toHaveAttribute("aria-valuenow", "0");
    expect(
      screen.getByRole("button", { name: "Skills: Incomplete" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Profile photo: Incomplete" }),
    ).toBeVisible();
  });
});
