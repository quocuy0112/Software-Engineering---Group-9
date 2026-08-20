import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileOverview } from "@/frontend/features/profile/components/profile-overview";
import { UnsavedChangesNavigationDialog } from "@/frontend/features/profile/client/unsaved-changes";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  }),
}));

const emptyProfile = {
  revision: 0,
  empty: true,
  basics: { headline: null, summary: null, phone: null, location: null },
  skills: [],
  experience: [],
  education: [],
  socialLinks: [],
};

const filledProfile = {
  revision: 4,
  empty: false,
  basics: {
    headline: "Senior product engineer",
    summary: "Builds reliable systems.",
    phone: "+84 912 345 678",
    location: "Ho Chi Minh City",
  },
  skills: [{ id: "skill-1", label: "TypeScript" }],
  experience: [
    {
      id: "experience-1",
      title: "Product Engineer",
      company: "Acme Labs",
      description: "Improved the developer platform.",
      startDate: "2022-01-01",
      endDate: null,
      current: true,
    },
  ],
  education: [
    {
      id: "education-1",
      institution: "HCMUS",
      degree: "BSc Computer Science",
      field: "Software engineering",
      startDate: "2018-09-01",
      endDate: "2022-06-01",
      current: false,
    },
  ],
  socialLinks: [{ id: "link-1", url: "https://github.com/example" }],
};

const account = {
  id: "8fc8b912-baad-4be8-8c49-f8f9323f6255",
  name: "Candidate Example",
  email: "candidate@example.com",
  memberSince: "July 31, 2026",
  twoFactorEnabled: true,
};

describe("professional profile accessibility", () => {
  it("provides labelled keyboard-operable collection controls", () => {
    render(
      <ProfileOverview
        account={account}
        initialProfile={emptyProfile}
        csrfProof="csrf-proof"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add skill" }));
    fireEvent.click(screen.getByRole("button", { name: "Add skill" }));
    expect(screen.getByLabelText("Skill 1")).toBeVisible();
    expect(screen.getByLabelText("Skill 2")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Move skill 1 down" }),
    ).toHaveAttribute("type", "button");
    expect(
      screen.getByRole("button", { name: "Remove skill 2" }),
    ).toHaveAttribute("type", "button");

    fireEvent.click(screen.getByRole("button", { name: "Add experience" }));
    const experience = screen.getByRole("group", { name: "Experience 1" });
    expect(within(experience).getByLabelText("Title")).toBeVisible();
    expect(within(experience).getByLabelText("Company")).toBeVisible();
    expect(within(experience).getByLabelText("Start date")).toHaveAttribute(
      "type",
      "date",
    );
    expect(within(experience).getByLabelText("Current role")).toHaveAttribute(
      "type",
      "checkbox",
    );

    fireEvent.click(screen.getByRole("button", { name: "Add education" }));
    const education = screen.getByRole("group", { name: "Education 1" });
    expect(within(education).getByLabelText("Institution")).toBeVisible();
    expect(within(education).getByLabelText("Degree")).toBeVisible();
    expect(
      within(education).getByLabelText("Currently studying"),
    ).toHaveAttribute("type", "checkbox");

    fireEvent.click(screen.getByRole("button", { name: "Add social link" }));
    expect(screen.getByLabelText("Profile or website link")).toHaveFocus();

    fireEvent.click(
      screen.getByRole("button", { name: "Use GitHub template" }),
    );
    expect(screen.getByLabelText("Profile or website link")).toHaveValue(
      "https://github.com/",
    );
    fireEvent.change(screen.getByLabelText("Profile or website link"), {
      target: { value: "https://github.com/example" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    expect(screen.getByLabelText("GitHub URL")).toHaveAttribute("type", "url");
    expect(
      screen.getByRole("button", { name: "Remove social link 1" }),
    ).toHaveAttribute("type", "button");

    expect(
      screen.getByRole("button", { name: "GitHub profile added" }),
    ).toBeDisabled();
    expect(
      document.querySelector(
        '.social-link-row-platform .social-platform-mark[data-platform="github"] svg',
      ),
    ).toHaveAttribute("data-platform-logo", "github");
  });

  it("uses explicit text and ARIA semantics instead of color-only state", () => {
    render(
      <ProfileOverview
        account={account}
        initialProfile={emptyProfile}
        csrfProof="csrf-proof"
      />,
    );
    expect(screen.getByText(/not filled yet/i)).toBeVisible();
    expect(screen.getByText(/no skills added/i)).toBeVisible();
    expect(screen.getByText(/no experience added/i)).toBeVisible();
    expect(screen.getByText(/no education added/i)).toBeVisible();
    expect(screen.getByText(/no professional links added/i)).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Save feedback" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy account ID" }),
    ).toHaveAttribute("type", "button");
  });

  it("keeps saved sections read-only until an explicit edit action", () => {
    render(
      <ProfileOverview
        account={account}
        initialProfile={filledProfile}
        csrfProof="csrf-proof"
      />,
    );

    expect(screen.getByText("Senior product engineer")).toBeVisible();
    expect(screen.getByText("TypeScript")).toBeVisible();
    expect(screen.getByText("Acme Labs", { exact: false })).toBeVisible();
    expect(screen.getByText("HCMUS", { exact: false })).toBeVisible();
    expect(
      screen.getByRole("link", { name: "https://github.com/example" }),
    ).toHaveAttribute("href", "https://github.com/example");
    expect(screen.queryByLabelText("Skill 1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit skills" }));
    expect(screen.getByLabelText("Skill 1")).toHaveValue("TypeScript");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Skill 1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit experience" }));
    expect(screen.getByRole("group", { name: "Experience 1" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Product Engineer")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Edit education" }));
    expect(screen.getByRole("group", { name: "Education 1" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("BSc Computer Science")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Edit professional links" }),
    );
    expect(screen.getByLabelText("GitHub URL")).toHaveValue(
      "https://github.com/example",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("link", { name: "https://github.com/example" }),
    ).toBeVisible();
  });

  it("renders an accessible brand logo for each supported social platform", () => {
    render(
      <ProfileOverview
        account={account}
        initialProfile={emptyProfile}
        csrfProof="csrf-proof"
      />,
    );

    for (const platform of ["linkedin", "github", "facebook", "instagram"]) {
      const icon = document.querySelector(
        `[data-platform="${platform}"] .social-platform-mark svg`,
      );
      expect(icon).toHaveAttribute("data-platform-logo", platform);
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("lists every saved social profile with its matching brand logo", () => {
    render(
      <ProfileOverview
        account={account}
        initialProfile={{
          ...filledProfile,
          socialLinks: [
            { id: "link-1", url: "https://linkedin.com/in/example" },
            { id: "link-2", url: "https://github.com/example" },
            { id: "link-3", url: "https://facebook.com/example" },
            { id: "link-4", url: "https://instagram.com/example" },
          ],
        }}
        csrfProof="csrf-proof"
      />,
    );

    for (const platform of ["linkedin", "github", "facebook", "instagram"]) {
      expect(
        document.querySelector(
          `.profile-social-link .social-platform-logo[data-platform-logo="${platform}"]`,
        ),
      ).toHaveAttribute("aria-hidden", "true");
    }
    expect(
      screen.getByRole("link", { name: "https://github.com/example" }),
    ).toHaveAttribute("href", "https://github.com/example");
  });

  it("marks edited sections and blocks accidental in-app navigation", async () => {
    render(
      <>
        <UnsavedChangesNavigationDialog />
        <ProfileOverview
          account={account}
          initialProfile={emptyProfile}
          csrfProof="csrf-proof"
        />
      </>,
    );

    fireEvent.change(screen.getByLabelText("Headline"), {
      target: { value: "Senior product engineer" },
    });
    expect(screen.getByText("Unsaved")).toBeVisible();
    expect(fireEvent.click(screen.getByRole("link", { name: "Account" }))).toBe(
      false,
    );
    expect(
      screen.getByRole("dialog", { name: "You have unsaved changes" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Stay on page" }),
      ).toHaveFocus(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Stay on page" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ships 320px-safe and reduced-motion styles", () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        "src/frontend/features/profile/styles/professional-profile.css",
      ),
      "utf8",
    );
    expect(css).toMatch(/@media\s*\(max-width:\s*320px\)/);
    expect(css).toMatch(/max-width:\s*100%/);
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toMatch(/focus-visible/);
    expect(css).toMatch(/\.profile-compact-row/);
    expect(css).toMatch(/\.profile-compact-chip/);
  });
});
