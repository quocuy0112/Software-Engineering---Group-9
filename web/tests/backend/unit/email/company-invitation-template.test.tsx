import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CompanyInvitationTemplate,
  companyInvitationEmailText,
} from "@/backend/email/templates/company-invitation";

describe("company invitation email template", () => {
  it("renders the recipient-only acceptance link and expiry guidance", () => {
    const invitationUrl =
      "http://localhost:3001/recruiter/company-invitation?token=opaque-token";
    const props = {
      companyName: "Example Company",
      role: "Recruiter",
      invitationUrl,
    };
    const html = renderToStaticMarkup(
      <CompanyInvitationTemplate {...props} />,
    );
    const text = companyInvitationEmailText(props);

    expect(html.match(/href=/gu) ?? []).toHaveLength(1);
    expect(`${html}${text}`).toContain(invitationUrl);
    expect(`${html}${text}`).toContain("one-time");
    expect(`${html}${text}`).toContain("seven days");
  });
});
