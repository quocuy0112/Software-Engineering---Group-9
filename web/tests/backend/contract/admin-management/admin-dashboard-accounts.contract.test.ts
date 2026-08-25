import { describe, expect, it } from "vitest";
import {
  accountListItemSchema,
  approvedVerificationEvidenceSchema,
  dashboardSnapshotSchema,
  listEnvelope,
} from "@/shared/contracts/admin/resources";
import { ADMIN_STATE_DEFINITION_VERSION } from "@/shared/contracts/admin/common";

describe("dashboard and account contracts", () => {
  it("requires calculation metadata on independent lists", () => {
    expect(() =>
      listEnvelope(accountListItemSchema).parse({ data: [], total: 0 }),
    ).toThrow();
    expect(
      listEnvelope(accountListItemSchema).parse({
        data: [],
        total: 0,
        calculatedAt: "2026-08-10T00:00:00.000Z",
        stateDefinitionVersion: ADMIN_STATE_DEFINITION_VERSION,
      }),
    ).toBeTruthy();
  });

  it("requires snapshot expiry, units, and the shared version", () => {
    expect(
      dashboardSnapshotSchema.parse({
        id: "snapshot-1",
        calculatedAt: "2026-08-10T00:00:00.000Z",
        expiresAt: "2026-08-10T00:01:00.000Z",
        stateDefinitionVersion: ADMIN_STATE_DEFINITION_VERSION,
        metrics: { active: { value: 1, unit: "PEOPLE" } },
      }).metrics.active?.value,
    ).toBe(1);
  });

  it("keeps approved verification evidence metadata safe and addressable", () => {
    const evidence = {
      requestId: "request-1",
      evidenceId: "evidence-1",
      companyName: "Example Company",
      taxIdentifier: "0109934230",
      submittedAt: "2026-08-10T00:00:00.000Z",
      approvedAt: "2026-08-11T00:00:00.000Z",
      version: 1,
      fileName: "business-license-1.pdf",
      mediaType: "application/pdf" as const,
      byteSize: 74932,
      safetyState: "PASS" as const,
      accessibility: "AVAILABLE" as const,
      unavailabilityReason: null,
    };
    expect(approvedVerificationEvidenceSchema.parse(evidence)).toEqual(
      evidence,
    );
    expect(() =>
      approvedVerificationEvidenceSchema.parse({
        ...evidence,
        storageLocator: "must-not-cross-the-admin-contract",
      }),
    ).toThrow();
  });
});
