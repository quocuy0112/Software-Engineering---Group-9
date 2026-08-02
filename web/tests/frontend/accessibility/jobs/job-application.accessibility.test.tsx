import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobApplicationForm } from "@/frontend/features/jobs/components/job-application-form";

describe("job application accessibility", () => {
  it("provides a named form, field instructions, and cancel action", () => {
    render(
      <JobApplicationForm
        form={{
          jobId: "j",
          jobTitle: "Engineer",
          companyName: "Company",
          profileReady: false,
          missingProfileFields: ["headline"],
          cvs: [],
          questions: [],
          consentVersion: "v1",
          csrfToken: "csrf",
        }}
        onCancel={() => undefined}
        onSubmitted={() => undefined}
      />,
    );
    expect(
      screen.getByRole("form", { name: /apply for engineer/i }),
    ).toBeVisible();
    expect(
      screen
        .getAllByRole("alert")
        .some((alert) => /headline/i.test(alert.textContent ?? "")),
    ).toBe(true);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeVisible();
  });
});
