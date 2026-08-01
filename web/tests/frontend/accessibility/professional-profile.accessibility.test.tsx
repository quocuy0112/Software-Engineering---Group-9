import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileOverview } from "@/frontend/features/profile/components/profile-overview";

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

const account = {
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
    expect(screen.getByLabelText("Social link 1")).toHaveAttribute(
      "type",
      "url",
    );
    expect(
      screen.getByRole("button", { name: "Remove social link 1" }),
    ).toHaveAttribute("type", "button");

    fireEvent.click(screen.getByRole("button", { name: "Add GitHub profile" }));
    expect(screen.getByLabelText("GitHub URL")).toHaveValue(
      "https://github.com/",
    );
    expect(
      screen.getByRole("button", { name: "GitHub profile added" }),
    ).toBeDisabled();
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
      screen.getByRole("region", { name: "Save feedback" }),
    ).toHaveAttribute("aria-live", "polite");
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
  });
});
