import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecruiterHeaderAction } from "@/frontend/features/recruiter-header/components/recruiter-header-action";

describe("recruiter header action accessibility", () => {
  it.each([
    {
      state: "NEVER_APPLIED" as const,
      destinationKind: "EMPLOYER_VERIFICATION" as const,
      href: "/dashboard/employer-verification" as const,
    },
    {
      state: "PENDING_REVIEW" as const,
      destinationKind: "NONE" as const,
      href: null,
    },
    {
      state: "CHANGES_REQUESTED" as const,
      destinationKind: "EMPLOYER_VERIFICATION" as const,
      href: "/dashboard/employer-verification" as const,
    },
    {
      state: "REJECTED" as const,
      destinationKind: "EMPLOYER_VERIFICATION" as const,
      href: "/dashboard/employer-verification" as const,
    },
    {
      state: "APPROVED" as const,
      destinationKind: "RECRUITER_WORKSPACE" as const,
      href: "https://recruiter.example.test",
    },
  ])("has no serious or critical axe findings for $state", async (status) => {
    const { container } = render(
      <RecruiterHeaderAction
        initialStatus={{
          ...status,
          observedAt: "2026-08-11T00:00:00.000Z",
        }}
      />,
    );
    const axe = (await import("axe-core")).default;
    const result = await axe.run(container);
    expect(
      result.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      ),
    ).toHaveLength(0);
  });
});
