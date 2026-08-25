import { render, screen } from "@testing-library/react";
import { RecordContextProvider } from "react-admin";
import { describe, expect, it } from "vitest";
import {
  VerificationApplicantField,
  VerificationAssignmentField,
  VerificationCompanyField,
  VerificationStateField,
} from "@/frontend/features/admin/verification/verification-list-fields";

describe("verification request list fields", () => {
  it("makes an unassigned reviewable request easy to triage", () => {
    render(
      <RecordContextProvider
        value={{
          id: "request-1",
          applicantId: "applicant-1",
          companyName: "Example Company",
          taxCode: "0123456789",
          targetCompanyId: "company-1",
          state: "PENDING_REVIEW",
          applicantEligibility: "ACTIVE",
          resubmissionCount: 2,
          assignedAdminRef: null,
          assignmentStatus: "UNASSIGNED",
        }}
      >
        <VerificationCompanyField />
        <VerificationApplicantField />
        <VerificationStateField />
        <VerificationAssignmentField />
      </RecordContextProvider>,
    );
    expect(screen.getByText("Example Company")).toBeVisible();
    expect(screen.getByText("Tax ID: 0123456789")).toBeVisible();
    expect(screen.getByText("Company ID: company-1")).toBeVisible();
    expect(screen.getByText("Pending Review")).toBeVisible();
    expect(screen.getByText("Resubmitted 2 times")).toBeVisible();
    expect(screen.getByText("Unassigned")).toBeVisible();
  });
});
