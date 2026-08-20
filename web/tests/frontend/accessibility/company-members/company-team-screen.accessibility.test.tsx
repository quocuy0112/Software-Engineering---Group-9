import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/frontend/features/authentication/client/csrf-proof-context", () => ({ useCsrfProof: () => "csrf" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { CompanyTeamScreen } from "@/frontend/features/recruiter-workspace/company-team-screen";

describe("CompanyTeamScreen accessibility", () => {
  it("labels the form, pending invitations, and live status", () => {
    render(<CompanyTeamScreen members={[]} invitations={[]} />);
    expect(screen.getByLabelText("Work email")).toBeTruthy();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("heading", { name: "Pending invitations" })).toBeTruthy();
  });
});
