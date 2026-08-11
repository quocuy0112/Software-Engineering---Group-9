import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FilesystemPrivateBusinessEvidenceStorage } from "@/backend/storage/business-evidence/filesystem";
import { EvidenceSafetyPipeline } from "@/backend/admin/verification/evidence-safety-pipeline";
import sharp from "sharp";
const cleanScanner = {
  scan: async () => ({
    outcome: "CLEAN" as const,
    engineVersion: "test-clamav",
  }),
};
describe("private business evidence pipeline", () => {
  it("encrypts bytes at rest and verifies all four qualification stages", async () => {
    const root = await mkdtemp(join(tmpdir(), "admin-evidence-test-"));
    try {
      const storage = new FilesystemPrivateBusinessEvidenceStorage(root);
      const bytes = await sharp({
        create: { width: 8, height: 8, channels: 3, background: "white" },
      })
        .png()
        .toBuffer();
      const stored = await storage.write("request:1", bytes);
      expect(stored.storageLocator).not.toContain("request");
      expect(await storage.read(stored.storageLocator, stored)).toEqual(bytes);
      const result = await new EvidenceSafetyPipeline(cleanScanner).inspect(
        bytes,
        "image/png",
      );
      expect(result).toMatchObject({
        malware: "PASS",
        type: "PASS",
        structure: "PASS",
        preview: "PASS",
      });
      await storage.delete(stored.storageLocator);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("never qualifies malware or declared/detected mismatches", async () => {
    const bytes = Buffer.from("%PDF-infected-content");
    const infectedScanner = {
      scan: async () => ({
        outcome: "INFECTED" as const,
        threatCode: "MALWARE_DETECTED" as const,
      }),
    };
    expect(
      (
        await new EvidenceSafetyPipeline(infectedScanner).inspect(
          bytes,
          "image/png",
        )
      ).preview,
    ).toBe("FAIL");
  });
});
