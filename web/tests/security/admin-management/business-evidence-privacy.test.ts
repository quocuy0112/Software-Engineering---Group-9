import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("business evidence privacy", () => {
  it("never projects storage locators and uses no public evidence URL", () => {
    const access = read(
      "src/backend/admin/verification/evidence-access-service.ts",
    );
    const viewer = read(
      "src/frontend/features/admin/verification/protected-evidence-viewer.tsx",
    );
    const normalizer = read(
      "src/backend/admin/verification/business-evidence-preview.ts",
    );
    expect(viewer).not.toMatch(/https?:\/\/|localStorage|sessionStorage/u);
    expect(viewer).toContain("URL.createObjectURL");
    expect(viewer).toContain("URL.revokeObjectURL");
    expect(viewer).not.toContain("pdfjs-dist");
    expect(viewer).toContain('blob.type !== "image/png"');
    expect(normalizer).toContain("pdfjs.getDocument");
    expect(access.replaceAll("\n", " ")).not.toMatch(
      /return\s+\{[^}]*storageLocator/u,
    );
  });

  it("requires fresh administrator authority on preview and download routes", () => {
    for (const action of ["preview", "download"]) {
      const source = read(
        `src/app/api/admin/verification-requests/[requestId]/evidence/[evidenceId]/${action}/route.ts`,
      );
      expect(source).toContain("AdminRequestBoundary");
      expect(source).toContain("sensitive: true");
      expect(source).toContain("adminNoStoreHeaders");
    }
  });
});
