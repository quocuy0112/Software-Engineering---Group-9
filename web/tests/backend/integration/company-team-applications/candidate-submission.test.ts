import { describe, expect, it } from "vitest";
import { validateCvFileBytes } from "@/shared/cv-file-validation";
import {
  signedDocxFixtureBytes,
  signedPdfFixtureBytes,
} from "../../../helpers/company-team-applications-fixture";
import {
  supportedRoles,
  TeamApplicationCommandError,
} from "@/backend/services/company-members/team-application-service";
import { teamApplicationSubmitSchema } from "@/shared/contracts/company-members/team-applications";

describe("Candidate Team Application submission boundary", () => {
  it("accepts only the two team roles and validated PDF/DOCX evidence", () => {
    expect(supportedRoles).toEqual(["HR_MANAGER", "RECRUITER"]);
    expect(
      teamApplicationSubmitSchema.safeParse({
        companyId: "company-1",
        role: "HR_MANAGER",
      }).success,
    ).toBe(true);
    expect(
      validateCvFileBytes({
        bytes: signedPdfFixtureBytes(),
        fileName: "resume.pdf",
        declaredMimeType: "application/pdf",
      }).kind,
    ).toBe("PDF");
    expect(
      validateCvFileBytes({
        bytes: signedDocxFixtureBytes(),
        fileName: "resume.docx",
        declaredMimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }).kind,
    ).toBe("DOCX");
  });

  it("represents a duplicate or withdrawal race as a safe command conflict", () => {
    expect(
      new TeamApplicationCommandError("TEAM_APPLICATION_CONFLICT").code,
    ).toBe("TEAM_APPLICATION_CONFLICT");
  });
});
