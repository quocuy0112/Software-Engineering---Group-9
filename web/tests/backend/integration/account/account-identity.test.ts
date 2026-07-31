import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import {
  createProfileDatabaseAccount,
  deleteProfileDatabaseAccounts,
} from "../../../helpers/profile-database-fixture";
import { AccountIdentityService } from "@/backend/services/account/account-identity-service";

let owner: Awaited<ReturnType<typeof createProfileDatabaseAccount>>;
let other: Awaited<ReturnType<typeof createProfileDatabaseAccount>>;
let inactive: Awaited<ReturnType<typeof createProfileDatabaseAccount>>;

beforeAll(async () => {
  owner = await createProfileDatabaseAccount("identity-owner");
  other = await createProfileDatabaseAccount("identity-other");
  inactive = await createProfileDatabaseAccount("identity-inactive", {
    state: "SUSPENDED",
  });
});

afterAll(async () => {
  await deleteProfileDatabaseAccounts([
    owner.userId,
    other.userId,
    inactive.userId,
  ]);
});

describe("account identity ownership", () => {
  it("reads only the owner-safe identity and nullable pending projection", async () => {
    const identity = await new AccountIdentityService().get(owner.userId);
    expect(identity).toMatchObject({
      name: "Profile identity-owner",
      email: owner.email,
      emailVerified: true,
      accountState: "ACTIVE",
      pendingEmailChange: null,
    });
    expect(identity.createdAt).toMatch(/Z$/);
    expect(JSON.stringify(identity)).not.toMatch(
      /userId|token|digest|outbox|session|correlation/i,
    );
  });

  it("updates only a sanitized name and leaves immutable metadata/email intact", async () => {
    const before = await new AccountIdentityService().get(owner.userId);
    const outcome = await new AccountIdentityService().updateName(
      owner.userId,
      {
        name: "  Candidate <img src=x onerror=globalThis.identityXss=true> An  ",
      },
    );
    expect(outcome.identity.name).toBe("Candidate An");
    expect(outcome.identity.email).toBe(before.email);
    expect(outcome.identity.createdAt).toBe(before.createdAt);
    expect(
      await prisma.userAccount.findUnique({
        where: { id: owner.userId },
        select: { name: true, email: true, normalizedEmail: true },
      }),
    ).toEqual({
      name: "Candidate An",
      email: owner.email,
      normalizedEmail: owner.email,
    });
  });

  it("rechecks ACTIVE state and cannot update another owner", async () => {
    await expect(
      new AccountIdentityService().get(inactive.userId),
    ).rejects.toThrow("ACCOUNT_IDENTITY_UNAVAILABLE");
    await expect(
      new AccountIdentityService().updateName(inactive.userId, {
        name: "Denied",
      }),
    ).rejects.toThrow("ACCOUNT_IDENTITY_UNAVAILABLE");
    expect((await new AccountIdentityService().get(other.userId)).name).toBe(
      "Profile identity-other",
    );
  });

  it("rolls back an invalid normalized name without touching identity", async () => {
    const before = await new AccountIdentityService().get(owner.userId);
    await expect(
      new AccountIdentityService().updateName(owner.userId, {
        name: "<script>alert(1)</script>",
      }),
    ).rejects.toThrow();
    expect(await new AccountIdentityService().get(owner.userId)).toEqual(
      before,
    );
  });
});
