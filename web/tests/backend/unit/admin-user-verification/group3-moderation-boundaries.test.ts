import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const source = (relativePath: string) =>
  readFileSync(resolve(root, relativePath), "utf8");

describe("Feature 009 Group 3 moderation boundaries", () => {
  it("uses the canonical Restore event and protected-target denial branch", () => {
    const service = source("src/backend/admin/accounts/admin-account-service.ts");
    const receipt = source("src/backend/repositories/admin/prisma-admin-command-repository.ts");
    expect(service).toContain('kind === "restore"');
    expect(service).toContain('kind === "restore" ? "admin.account_restored"');
    expect(service).toContain("AdminCommandDenied");
    expect(receipt).toContain('resultCode = "DENIED"');
    expect(receipt).toContain("AdminCommandDenied");
  });

  it("keeps suspension atomic and does not expose the removed route", () => {
    const service = source("src/backend/admin/accounts/admin-account-service.ts");
    const transaction = source("src/backend/admin/accounts/admin-account-command-transaction.ts");
    expect(service).toContain("FOR UPDATE");
    expect(service).toContain("authenticationChallenge.updateMany");
    expect(service).toContain("session.updateMany");
    expect(transaction).toContain("PrivilegedRationaleService");
    expect(transaction).toContain("PrismaSecurityNotificationRepository");
    expect(existsSync(resolve(root, "src/app/api/admin/accounts/[accountId]/reinstate/route.ts"))).toBe(false);
  });
});
