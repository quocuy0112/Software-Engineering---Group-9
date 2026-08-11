import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("administrator browser privacy", () => {
  it("uses a memory-only store and zero-retention query cache", () => {
    const auth = read("src/frontend/features/admin/app/auth-provider.ts");
    const query = read("src/frontend/features/admin/app/query-client.ts");
    expect(auth).not.toMatch(/localStorage|sessionStorage|document[.]cookie/u);
    expect(query).toMatch(/gcTime:\s*0/u);
    expect(query).toMatch(/staleTime:\s*0/u);
  });

  it("keeps secrets, rationales, private reports, and evidence out of URLs", () => {
    const provider = read("src/frontend/features/admin/app/data-provider.ts");
    const viewer = read(
      "src/frontend/features/admin/verification/protected-evidence-viewer.tsx",
    );
    expect(provider).not.toMatch(/explanation=.*|privateNote=.*|detail=.*/u);
    expect(viewer).not.toMatch(/storageLocator|signedUrl|presigned/u);
    expect(viewer).toContain("no-store");
  });
});
