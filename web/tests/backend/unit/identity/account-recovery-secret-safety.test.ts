import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const recoveryFiles = [
  "src/backend/services/recovery/request-full-account-recovery.ts",
  "src/backend/services/profile/authorize-account-recovery-route.ts",
  "src/backend/services/recovery/confirm-full-account-recovery.ts",
  "src/backend/services/recovery/cancel-full-account-recovery.ts",
  "src/backend/services/recovery/complete-full-account-recovery.ts",
  "src/backend/repositories/identity/prisma-account-recovery-repository.ts",
  "src/app/api/identity/account-recovery/request/route.ts",
  "src/app/api/identity/account-recovery/capability/route.ts",
  "src/app/api/identity/account-recovery/confirm/route.ts",
  "src/app/api/identity/account-recovery/cancel/route.ts",
  "src/app/api/identity/account-recovery/complete/route.ts",
  "src/backend/security/account-recovery-capability.ts",
  "src/frontend/features/authentication/client/use-account-recovery-capability.ts",
];

describe("account recovery secret safety", () => {
  it("contains no logging sink or query-string proof construction", async () => {
    const source = (
      await Promise.all(
        recoveryFiles.map((path) =>
          readFile(resolve(process.cwd(), path), "utf8"),
        ),
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
