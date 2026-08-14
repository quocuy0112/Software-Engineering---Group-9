import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("business verification privacy boundaries", () => {
  it("keeps raw provider bodies and token material out of routes and UI", () => {
    const sources = [
      "src/app/api/employer-verifications/preparation/route.ts",
      "src/app/api/employer-verifications/registry-lookups/route.ts",
      "src/app/api/employer-verifications/company-email/challenges/route.ts",
      "src/app/api/employer-verifications/company-email/confirm/route.ts",
      "src/frontend/features/employer-verification/employer-verification-page.tsx",
    ].map((path) => readFileSync(path, "utf8")).join("\n");
    expect(sources).not.toMatch(/tokenDigest|recipientCiphertext|storageLocator|rawResponse|responseBody/gu);
    expect(sources).not.toMatch(/localStorage|sessionStorage|indexedDB/gu);
  });

  it("uses fragment delivery and removes the fragment before confirmation", () => {
    const worker = readFileSync("src/backend/email/workers/email-outbox.ts", "utf8");
    const page = readFileSync(
      "src/frontend/features/employer-verification/employer-verification-page.tsx",
      "utf8",
    );
    expect(worker).toContain("verificationUrl.hash");
    expect(worker).not.toContain("searchParams.set(\"company-email-token\"");
    expect(page.indexOf("history.replaceState")).toBeLessThan(
      page.indexOf('requestJson("/api/employer-verifications/company-email/confirm"'),
    );
  });
});
