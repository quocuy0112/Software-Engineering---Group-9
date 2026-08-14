import { describe, expect, it } from "vitest";
import {
  companyEmailSignals,
  createCompanyEmailToken,
  digestCompanyEmailValue,
  maskCompanyEmail,
} from "@/backend/admin/verification/company-email-verification";

describe("company email challenge helpers", () => {
  it("creates opaque tokens and deterministic non-plaintext digests", () => {
    const firstToken = createCompanyEmailToken();
    const secondToken = createCompanyEmailToken();
    const digest = digestCompanyEmailValue("hr@example.vn");

    expect(firstToken).toHaveLength(43);
    expect(secondToken).not.toBe(firstToken);
    expect(digest).toHaveLength(64);
    expect(digest).not.toContain("hr@example.vn");
    expect(digestCompanyEmailValue("hr@example.vn")).toBe(digest);
  });

  it("masks mailboxes and derives non-decisive domain signals", () => {
    expect(maskCompanyEmail("human.resources@example.vn")).toBe(
      "hu***@example.vn",
    );
    expect(companyEmailSignals("hr@gmail.com", "https://example.vn")).toEqual({
      freeProvider: true,
      websiteDomainMatch: false,
    });
    expect(
      companyEmailSignals("hr@team.example.vn", "https://example.vn"),
    ).toEqual({ freeProvider: false, websiteDomainMatch: true });
    expect(companyEmailSignals("hr@example.vn")).toEqual({
      freeProvider: false,
      websiteDomainMatch: null,
    });
  });
});
