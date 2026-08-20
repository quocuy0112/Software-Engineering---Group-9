import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CompanyInvitationResponseTemplate,
  companyInvitationResponseEmailText,
} from "@/backend/email/templates/company-invitation-response";

describe("company invitation response email template", () => {
  it("describes an accepted invitation for the Owner", () => {
    const props = {
      companyName: "Example Company",
      recipientEmail: "member@example.com",
      outcome: "ACCEPTED" as const,
      role: "Recruiter",
    };
    const output = `${renderToStaticMarkup(<CompanyInvitationResponseTemplate {...props} />)}${companyInvitationResponseEmailText(props)}`;

    expect(output).toContain("member@example.com");
    expect(output).toContain("accepted");
    expect(output).toContain("Example Company");
  });

  it("describes a declined invitation for the Owner", () => {
    const output = companyInvitationResponseEmailText({
      companyName: "Example Company",
      recipientEmail: "member@example.com",
      outcome: "DECLINED",
      role: "HR Manager",
    });

    expect(output).toContain("declined");
  });
});
