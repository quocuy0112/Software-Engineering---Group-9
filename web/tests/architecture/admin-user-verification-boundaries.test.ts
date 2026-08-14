import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("Feature 009 route and privacy boundaries", () => {
  it("does not expose removed current Admin commands", () => {
    expect(
      existsSync(
        resolve(root, "src/app/api/admin/accounts/[accountId]/reinstate/route.ts"),
      ),
    ).toBe(false);
    expect(
      existsSync(
        resolve(root, "src/app/api/admin/verification-requests/[requestId]/request-changes/route.ts"),
      ),
    ).toBe(false);
    const provider = readFileSync(
      resolve(root, "src/frontend/features/admin/app/data-provider.ts"),
      "utf8",
    );
    expect(provider).not.toContain("request-changes");
    expect(provider).not.toContain("reinstate");
  });

  it("keeps the exact Feature 009 generated replacement route", () => {
    const generated = readFileSync(
      resolve(root, "src/shared/contracts/admin/generated/index.ts"),
      "utf8",
    );
    expect(generated).toContain("/api/admin/accounts/{accountId}/restore");
    expect(generated).toContain("/api/admin/verification-requests/{requestId}/reject");
  });
});
