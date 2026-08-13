import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { professionalConnectionContractManifest } from "@/shared/contracts/connections/generated";

describe("Feature 011 OpenAPI", () => {
  const contract = readFileSync(
    resolve(
      process.cwd(),
      "../spec-kit/specs/011-professional-connection-proposals/contracts/openapi.yaml",
    ),
    "utf8",
  );
  it("keeps every generated route in the committed API contract", () => {
    for (const path of professionalConnectionContractManifest.paths)
      expect(contract).toContain(`  ${path}:`);
  });
  it("requires CSRF, idempotency, and expected version on commands", () => {
    expect(contract).toContain("Idempotency-Key");
    expect(contract).toContain("If-Match-Version");
    expect(contract).toContain("X-CSRF-Proof");
  });
});
