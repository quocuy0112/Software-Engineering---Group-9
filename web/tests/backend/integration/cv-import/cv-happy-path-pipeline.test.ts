import { describe, expect, it, vi } from "vitest";

import { CvHappyPathPipeline } from "@/backend/cv/workers/happy-path-pipeline";

describe("CV happy-path pipeline ordering", () => {
  it("runs envelope -> integrity -> scan -> structure/extract -> integrity -> parse -> draft", async () => {
    const order: string[] = [];
    const pipeline = new CvHappyPathPipeline({
      validateEnvelope: async () => void order.push("envelope"),
      verifySourceIntegrity: async () => void order.push("source-integrity"),
      scan: async () => {
        order.push("scan");
        return "CLEAN" as const;
      },
      extract: async () => {
        order.push("extract");
        return [
          { id: "segment-1", kind: "paragraph" as const, text: "Synthetic" },
        ];
      },
      verifyExtractionIntegrity: async () =>
        void order.push("extraction-integrity"),
      parse: async () => {
        order.push("parse");
        return { schemaVersion: "cv-draft-v1" };
      },
      createDraft: async () => void order.push("draft"),
    });
    await pipeline.execute({
      uploadId: "upload_fixture",
      leaseOwner: "worker_fixture",
    });
    expect(order).toEqual([
      "envelope",
      "source-integrity",
      "scan",
      "extract",
      "extraction-integrity",
      "parse",
      "draft",
    ]);
  });

  it("creates no draft before CLEAN and all gates pass", async () => {
    const createDraft = vi.fn();
    const pipeline = new CvHappyPathPipeline({
      validateEnvelope: async () => undefined,
      verifySourceIntegrity: async () => undefined,
      scan: async () => "INFECTED" as const,
      extract: vi.fn(),
      verifyExtractionIntegrity: vi.fn(),
      parse: vi.fn(),
      createDraft,
    });
    await expect(
      pipeline.execute({
        uploadId: "upload_fixture",
        leaseOwner: "worker_fixture",
      }),
    ).rejects.toMatchObject({ code: "MALWARE_DETECTED" });
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("deduplicates delivery and rejects an expired lease before provider work", async () => {
    const pipeline = new CvHappyPathPipeline({
      validateEnvelope: vi.fn(),
      verifySourceIntegrity: vi.fn(),
      scan: vi.fn(),
      extract: vi.fn(),
      verifyExtractionIntegrity: vi.fn(),
      parse: vi.fn(),
      createDraft: vi.fn(),
      acceptDelivery: async ({ leaseOwner }) => leaseOwner === "current-worker",
    });
    await expect(
      pipeline.execute({
        uploadId: "upload_fixture",
        leaseOwner: "expired-worker",
      }),
    ).rejects.toMatchObject({ code: "CV_LEASE_LOST" });
  });
});
