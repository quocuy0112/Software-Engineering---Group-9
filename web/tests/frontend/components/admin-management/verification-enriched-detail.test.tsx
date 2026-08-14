import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VerificationBusinessFactsPanel } from "@/frontend/features/admin/verification/verification-business-facts-panel";

const facts = {
  applicantLegalName: "Applicant Company",
  applicantRegisteredAddress: "Applicant Address",
  operatingAddress: null,
  companyEmail: "hr@example.vn",
  companyEmailVerifiedAt: "2026-08-14T01:00:00.000Z",
  companyEmailFreeProvider: false,
  companyEmailWebsiteDomainMatch: true,
  companyPhoneE164: "+84901234567",
  companyPhoneVerified: false,
  websiteOrigin: "https://example.vn",
  relationship: "LEGAL_OWNER",
  currentJobTitle: "Owner",
  authorityExplanation: null,
  legalNameDiffers: true,
  registeredAddressDiffers: true,
  mismatchExplanation: "Registry information has not been updated yet.",
  accuracyDeclaredAt: "2026-08-14T01:00:00.000Z",
  documentConsentAt: "2026-08-14T01:00:00.000Z",
  policyVersion: "business-verification-consent-v1",
  registry: {
    outcome: "MATCHED",
    providerKey: "vietqr-v2",
    checkedAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-08-15T00:00:00.000Z",
    stale: false,
    legalName: "Registry Company",
    registeredAddress: "Registry Address",
    establishedAt: null,
    legalStatus: null,
    entityType: null,
    representativeName: null,
  },
};

describe("administrator enriched verification detail", () => {
  it("shows side-by-side differences and non-color contact labels", () => {
    render(<VerificationBusinessFactsPanel facts={facts} legacyRequest={false} enrichmentStatus="COMPLETE" />);
    expect(screen.getByText("Registry snapshot")).toBeVisible();
    expect(screen.getByText("Applicant claims")).toBeVisible();
    expect(screen.getByText("Phone unverified")).toBeVisible();
    expect(screen.getAllByText(/differs/i)).toHaveLength(2);
    expect(screen.getByText(/human decision only/i)).toBeVisible();
  });

  it("labels legacy requests without inventing facts", () => {
    render(<VerificationBusinessFactsPanel facts={null} legacyRequest />);
    expect(screen.getByText(/Legacy request/i)).toBeVisible();
    expect(screen.queryByText("Registry snapshot")).not.toBeInTheDocument();
  });

  it("blocks a corrupted enriched projection instead of treating it as legacy", () => {
    render(
      <VerificationBusinessFactsPanel
        facts={null}
        legacyRequest={false}
        enrichmentStatus="INCOMPLETE"
      />,
    );
    expect(screen.getByText(/cannot be approved/i)).toBeVisible();
  });
});
