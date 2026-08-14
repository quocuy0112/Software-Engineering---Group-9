import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("business verification Route Handler contracts", () => {
  it.each([
    "preparation/route.ts",
    "registry-lookups/route.ts",
    "company-email/challenges/route.ts",
    "company-email/confirm/route.ts",
  ])("keeps %s private, no-store, and service delegated", (relativePath) => {
    const source = readFileSync(
      `src/app/api/employer-verifications/${relativePath}`,
      "utf8",
    );
    expect(source).toContain("EmployerVerificationPreparationService");
    expect(source).toContain("private, no-store");
    expect(source).toContain("adminRouteError");
    expect(source).not.toContain("@/backend/database/prisma");
  });

  it("does not expose provider or token internals in route sources", () => {
    const sources = [
      "registry-lookups/route.ts",
      "company-email/challenges/route.ts",
      "company-email/confirm/route.ts",
    ].map((path) =>
      readFileSync(`src/app/api/employer-verifications/${path}`, "utf8"),
    );
    expect(sources.join("\n")).not.toMatch(/vietqr|tokenDigest|recipientCiphertext/iu);
  });
});
