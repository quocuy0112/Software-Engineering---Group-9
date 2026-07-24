import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const recoveryFiles = [
  "src/server/services/identity/request-full-account-recovery.ts",
  "src/server/services/identity/confirm-full-account-recovery.ts",
  "src/server/services/identity/cancel-full-account-recovery.ts",
  "src/server/services/identity/complete-full-account-recovery.ts",
  "src/server/repositories/identity/prisma-account-recovery-repository.ts",
  "src/app/api/identity/account-recovery/request/route.ts",
  "src/app/api/identity/account-recovery/confirm/route.ts",
  "src/app/api/identity/account-recovery/cancel/route.ts",
  "src/app/api/identity/account-recovery/complete/route.ts",
];

describe("account recovery secret safety", () => {
  it("contains no logging sink or query-string proof construction", async () => {
    const source = (
      await Promise.all(
        recoveryFiles.map((path) => readFile(resolve(process.cwd(), path), "utf8")),
      )
    ).join("\n");
    expect(source).not.toMatch(/\bconsole\.(?:log|info|warn|error|debug)\b/);
    expect(source).not.toMatch(/\b(?:logger|log)\.(?:info|warn|error|debug)\b/);
    expect(source).not.toMatch(/searchParams\.set\(\s*["'](?:proof|token)["']/);
    expect(source).not.toMatch(
      /context:\s*\{[^}]*(?:rawProof|newPassword|completionProof|cancellationProof|cookie)/,
    );
  });
});
