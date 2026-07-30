import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("full account recovery contract", () => {
  it("defines the capability-gated flow and fragment-only proof boundary", async () => {
    const contract = await readFile(
      resolve(
        process.cwd(),
        "../spec-kit/specs/001-identity-authentication-account-recovery/contracts/openapi.yaml",
      ),
      "utf8",
    );
    for (const route of [
      "/api/identity/account-recovery/request:",
      "/api/identity/account-recovery/capability:",
      "/api/identity/account-recovery/confirm:",
      "/api/identity/account-recovery/cancel:",
      "/api/identity/account-recovery/complete:",
    ]) {
      expect(contract).toContain(route);
    }
    expect(contract).toContain("Recovery proofs arrive only in URL fragments");
    expect(contract).toContain(
      "mutation endpoints require the resulting encrypted HttpOnly capability cookie",
    );
    expect(contract).toContain("recoveryCapabilityCookie:");
    expect(contract).toContain("RecoveryHoldActive");
    expect(contract).toContain("AccountRecoveryInstructionsQueued:");
    expect(contract).toContain("EligibleRecoveryAccountNotFound:");
    expect(contract).toContain(
      "'404': {$ref: '#/components/responses/EligibleRecoveryAccountNotFound'}",
    );
    expect(contract).not.toContain(
      "completionProof, cancellationProof, lowerAssuranceNotice",
    );
  });
});
