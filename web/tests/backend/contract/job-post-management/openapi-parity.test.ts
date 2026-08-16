import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  jobManagementCommandSchema,
  jobManagementListQuerySchema,
} from "@/shared/contracts/admin/job-post-management";

const openapi = readFileSync(
  resolve(
    process.cwd(),
    "../spec-kit/specs/018-admin-job-management/contracts/job-post-management.openapi.yaml",
  ),
  "utf8",
);

describe("administrator job post management OpenAPI parity", () => {
  it("documents each protected management endpoint and state dimension", () => {
    for (const operation of [
      "listManagedJobPosts",
      "getManagedJobPost",
      "commandManagedJobPost",
    ]) {
      expect(openapi).toContain(`operationId: ${operation}`);
    }
    expect(openapi).toContain("enum: [PUBLISHED, HIDDEN, ARCHIVED]");
    expect(openapi).toContain("enum: [OPEN, CLOSED]");
    expect(openapi).toContain("idempotency-key");
    expect(openapi).toContain("if-match");
  });

  it("keeps request contracts bounded and strict", () => {
    expect(jobManagementListQuerySchema.safeParse({ page: 0 }).success).toBe(
      false,
    );
    expect(
      jobManagementCommandSchema.safeParse({
        command: "HIDE",
        confirmation: true,
        reason: "required operational reason",
        unexpected: true,
      }).success,
    ).toBe(false);
  });
});
