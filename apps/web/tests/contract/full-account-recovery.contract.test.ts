import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("full account recovery contract", () => {
  it("defines the separate four-route flow and fragment-only proof boundary", async () => {
    const contract = await readFile(
      resolve(
        process.cwd(),
        "../../src/specs/001-identity-authentication-account-recovery/contracts/openapi.yaml",
      ),
      "utf8",
    );
    for (const route of [
      "/api/identity/account-recovery/request:",
      "/api/identity/account-recovery/confirm:",
      "/api/identity/account-recovery/cancel:",
      "/api/identity/account-recovery/complete:",
    ]) {
      expect(contract).toContain(route);
    }
    expect(contract).toContain("proofs arrive only in URL fragments");
    expect(contract).toContain("Proofs are never returned by the API.");
    expect(contract).toContain("RecoveryHoldActive");
    expect(contract).not.toContain("completionProof, cancellationProof, lowerAssuranceNotice");
  });
});
