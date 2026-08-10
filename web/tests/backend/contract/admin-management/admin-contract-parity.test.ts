import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { adminContractPaths } from "@/shared/contracts/admin/generated";
import { accountListItemSchema } from "@/shared/contracts/admin/resources";
import { adminDataProvider } from "@/frontend/features/admin/app/data-provider";

describe("Feature 006 contract parity", () => {
  it("contains exactly the 32 reviewed OpenAPI paths", () => {
    const source = readFileSync(
      "../spec-kit/specs/006-admin-management/contracts/admin-api.openapi.yaml",
      "utf8",
    );
    const paths = [...source.matchAll(/^ {2}(\/api\/[^:]+):$/gmu)].map(
      (match) => match[1],
    );
    expect(paths).toEqual([...adminContractPaths]);
    expect(paths).toHaveLength(32);
  });

  it("rejects projection fields that were not allowlisted", () => {
    expect(() =>
      accountListItemSchema.parse({
        id: "account-1",
        displayName: "Candidate",
        maskedEmail: "c***@example.test",
        state: "ACTIVE",
        createdAt: "2026-08-10T00:00:00.000Z",
        activeMembershipCount: 0,
        hasActiveAdministratorGrant: false,
        passwordHash: "must-never-pass",
      }),
    ).toThrow();
  });

  it("keeps generic privileged CRUD closed", async () => {
    await expect(
      adminDataProvider.create("accounts", { data: { state: "SUSPENDED" } }),
    ).rejects.toThrow("GENERIC_PRIVILEGED_CRUD_DISABLED");
    await expect(
      adminDataProvider.delete("companies", {
        id: "company-1",
        previousData: { id: "company-1" },
      }),
    ).rejects.toThrow("GENERIC_PRIVILEGED_CRUD_DISABLED");
  });
});
