import { describe, expect, it } from "vitest";
import { auth } from "@/backend/auth/cookies/config";

describe("Better Auth 1.6.25 backup-code ownership compatibility", () => {
  it("exposes only the pinned authoritative operations", () => {
    expect(auth.api).toHaveProperty("verifyBackupCode");
    expect(auth.api).toHaveProperty("generateBackupCodes");
    expect(auth.api).toHaveProperty("disableTwoFactor");
    expect(typeof auth.api.verifyBackupCode).toBe("function");
    expect(typeof auth.api.generateBackupCodes).toBe("function");
    expect(typeof auth.api.disableTwoFactor).toBe("function");
  });
});
