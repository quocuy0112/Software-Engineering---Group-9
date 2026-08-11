import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("administrator provisioning script", () => {
  const source = readFileSync(
    "scripts/provision-platform-administrator.mjs",
    "utf8",
  );
  const revokeSource = readFileSync(
    "scripts/revoke-platform-administrator.mjs",
    "utf8",
  );

  it("loads local operational configuration without copying database secrets", () => {
    expect(source).toContain('resolve(webRoot, ".env.local")');
    expect(source).toContain(
      "process.env.DIRECT_URL ?? process.env.DATABASE_URL",
    );
  });

  it("requires every approved account prerequisite and never deletes a grant", () => {
    expect(source).toContain('user.state === "ACTIVE"');
    expect(source).toContain("user.emailVerified");
    expect(source).toContain("user.twoFactorEnabled");
    expect(source).not.toMatch(/platformAdministratorGrant\.delete/u);
  });

  it("requires a fresh administrator sign-in when reactivating a grant", () => {
    expect(source).toContain('existing.state !== "ACTIVE"');
    expect(source).toContain("designatedSessionId: null");
    expect(source).toContain("initialTwoFactorAt: null");
    expect(source).toContain("latestTwoFactorProofAt: null");
    expect(source).toContain("administrator_grant_reprovisioned");
  });

  it("revokes authority without deleting the user or administrator grant", () => {
    expect(revokeSource).toContain('state: "REVOKED"');
    expect(revokeSource).toContain("administrator_grant_revoked");
    expect(revokeSource).toContain("designatedSessionId: null");
    expect(revokeSource).not.toMatch(
      /(?:userAccount|platformAdministratorGrant)\.delete/u,
    );
  });

  it("records both terminal grant transitions in the audit trail", () => {
    for (const script of [source, revokeSource]) {
      expect(script).toContain('actorType: "operator_terminal"');
      expect(script).toContain('source: "operator_terminal"');
      expect(script).toContain("auditEvent.create");
    }
  });
});
