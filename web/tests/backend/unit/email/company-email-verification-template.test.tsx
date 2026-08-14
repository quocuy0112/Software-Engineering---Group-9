import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CompanyEmailVerificationTemplate,
  companyEmailVerificationText,
} from "@/backend/email/templates/company-email-verification";

describe("company email verification template", () => {
  it("renders one fragment-only verification link without approval claims", () => {
    const url =
      "http://localhost:3001/verify-company-email#company-email-token=opaque-token";
    const html = renderToStaticMarkup(
      <CompanyEmailVerificationTemplate verificationUrl={url} />,
    );
    const text = companyEmailVerificationText(url);

    expect(html.match(/href=/gu) ?? []).toHaveLength(1);
    expect(`${html}${text}`).toContain("#company-email-token=");
    expect(`${html}${text}`).not.toContain("?company-email-token=");
    expect(`${html}${text}`).toContain("does not automatically approve");
  });
});
