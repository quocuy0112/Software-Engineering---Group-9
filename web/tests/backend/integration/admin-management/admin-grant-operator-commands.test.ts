import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";

const execute = promisify(execFile);
const suffix = randomUUID();
const userId = `operator-command-${suffix}`;
const email = `${userId}@example.test`;
let grantId: string | undefined;

async function runOperatorScript(script: string) {
  const { stdout } = await execute(
    process.execPath,
    ["--conditions=react-server", "--import", "tsx", script, email],
    { cwd: process.cwd(), env: process.env },
  );
  return JSON.parse(stdout.trim()) as {
    grantId: string;
    userId: string;
    state: "ACTIVE" | "REVOKED";
  };
}

afterAll(async () => {
  await prisma.platformAdministratorGrant.deleteMany({ where: { userId } });
  await prisma.authenticationChallenge.deleteMany({ where: { userId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.userAccount.deleteMany({ where: { id: userId } });
});

describe("administrator grant operator commands", () => {
  it("provisions, revokes, and safely reactivates a retained grant", async () => {
    await prisma.userAccount.create({
      data: {
        id: userId,
        name: "Operator Command Fixture",
        email,
        normalizedEmail: email,
        state: "ACTIVE",
        emailVerified: true,
        twoFactorEnabled: true,
      },
    });

    const provisioned = await runOperatorScript(
      "scripts/provision-platform-administrator.mjs",
    );
    grantId = provisioned.grantId;
    expect(provisioned).toMatchObject({ userId, state: "ACTIVE" });

    const sessionId = `operator-session-${suffix}`;
    await prisma.session.create({
      data: {
        id: sessionId,
        token: `operator-session-token-${suffix}`,
        userId,
        expiresAt: new Date(Date.now() + 86_400_000),
        absoluteExpiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    await prisma.administratorSessionPolicy.create({
      data: {
        grantId,
        designatedSessionId: sessionId,
        initialTwoFactorAt: new Date(),
        latestTwoFactorProofAt: new Date(),
        designationVersion: 1,
      },
    });

    const revoked = await runOperatorScript(
      "scripts/revoke-platform-administrator.mjs",
    );
    expect(revoked).toMatchObject({ grantId, userId, state: "REVOKED" });
    expect(
      await prisma.userAccount.findUniqueOrThrow({ where: { id: userId } }),
    ).toMatchObject({ state: "ACTIVE" });
    expect(
      await prisma.session.findUniqueOrThrow({ where: { id: sessionId } }),
    ).toMatchObject({
      revocationReason: "administrator_grant_revoked",
    });
    expect(
      await prisma.administratorSessionPolicy.findUniqueOrThrow({
        where: { grantId },
      }),
    ).toMatchObject({
      designatedSessionId: null,
      initialTwoFactorAt: null,
      latestTwoFactorProofAt: null,
    });

    const reactivated = await runOperatorScript(
      "scripts/provision-platform-administrator.mjs",
    );
    expect(reactivated).toMatchObject({ grantId, userId, state: "ACTIVE" });
    expect(
      await prisma.administratorSessionPolicy.findUniqueOrThrow({
        where: { grantId },
      }),
    ).toMatchObject({ designatedSessionId: null });
    expect(
      await prisma.auditEvent.count({
        where: {
          targetType: "platform_administrator_grant",
          targetId: grantId,
          action: {
            in: ["admin.grant_provisioned", "admin.grant_revoked"],
          },
        },
      }),
    ).toBe(3);
  });
});
