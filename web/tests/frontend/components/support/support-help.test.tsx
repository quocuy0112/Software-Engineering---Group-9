import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupportAccountRecoveryGuide } from "@/frontend/features/support/components/support-account-recovery-guide";
import { SupportFaq } from "@/frontend/features/support/components/support-faq";
import { SupportWorkspace } from "@/frontend/features/support/components/support-workspace";

vi.mock("@/frontend/features/support/client/use-support-invalidation", () => ({
  useSupportInvalidation: () => "CONNECTED",
}));

describe("Support help flow", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("filters FAQ questions and opens a popular answer", () => {
    render(<SupportFaq locale="en" />);

    const search = screen.getByRole("searchbox", {
      name: "Search frequently asked questions",
    });
    fireEvent.change(search, { target: { value: "suspicious activity" } });
    expect(
      screen.getByRole("button", {
        name: /what should i do if i notice suspicious activity/i,
      }),
    ).toBeVisible();

    fireEvent.change(search, { target: { value: "" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: "How is my Smart Match score calculated?",
      }),
    );

    expect(
      screen.getByText(/Smart Match compares information in your profile/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: /AI Smart Match\s*How is my Smart Match score calculated/i,
      }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("shows a recovery guide that reuses the password-reset and support routes", () => {
    render(<SupportAccountRecoveryGuide />);

    expect(
      screen.getByRole("link", { name: /reset password/i }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(
      screen.getByRole("link", { name: /contact support/i }),
    ).toHaveAttribute("href", "/support");
    expect(
      screen.getByRole("link", { name: /back to support center/i }),
    ).toHaveAttribute("href", "/support");
  });

  it("links the Support empty state to the FAQ and recovery guide", () => {
    render(<SupportWorkspace csrfProof="proof" initialCases={[]} />);

    expect(
      screen.getByRole("link", { name: /while you wait.*faq/i }),
    ).toHaveAttribute("href", "/support/faq");
    expect(
      screen.getByRole("link", { name: /account recovery guide/i }),
    ).toHaveAttribute("href", "/support/account-recovery");
  });
});
