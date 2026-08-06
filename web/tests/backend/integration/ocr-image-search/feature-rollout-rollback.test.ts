import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CreateImageSearchService } from "@/backend/services/image-search/create-image-search";

describe("Feature 005 rollout and rollback flags", () => {
  it("stops new admissions before readiness, quota, storage, OCR, or provider work", async () => {
    const readiness = { assertAdmissionReady: vi.fn() };
    const admission = { admit: vi.fn() };
    const service = new CreateImageSearchService({
      admission: admission as never,
      readiness,
      rateHmacKey: Buffer.alloc(32, 1),
      capabilityHmacKey: Buffer.alloc(32, 2),
      now: () => new Date("2026-08-06T00:00:00.000Z"),
      admissionEnabled: () => false,
    });
    await expect(
      service.execute({
        actor: {
          kind: "VISITOR",
          browserSubjectDigest: Buffer.alloc(32, 3),
        },
        sourceIpDigest: Buffer.alloc(32, 4),
        idempotencyKey: "rollout-disabled-0001",
        body: {
          extension: "png",
          mediaType: "image/png",
          bytes: 128,
          interpreterClass: "DETERMINISTIC_INTERNAL",
          consent: null,
        },
      }),
    ).rejects.toMatchObject({
      status: 503,
      code: "IMAGE_PROCESSING_UNAVAILABLE",
    });
    expect(readiness.assertAdmissionReady).not.toHaveBeenCalled();
    expect(admission.admit).not.toHaveBeenCalled();
  });

  it("keeps cleanup/reconciliation active while all processing stages are disabled", async () => {
    const entry = await readFile(
      resolve(process.cwd(), "src/backend/image-search/workers/entry.ts"),
      "utf8",
    );
    const runtime = await readFile(
      resolve(process.cwd(), "src/backend/image-search/workers/runtime.ts"),
      "utf8",
    );
    expect(entry).toContain("IMAGE_SEARCH_CLEANUP_REQUIRED");
    expect(entry).toContain(
      'processStages: process.env.IMAGE_SEARCH_WORKER_ENABLED === "true"',
    );
    expect(runtime.indexOf("reconciliation.runOnce")).toBeLessThan(
      runtime.indexOf("if (this.options.processStages === false) return 0"),
    );
    expect(runtime.indexOf("cleanup.runOnce")).toBeLessThan(
      runtime.indexOf("if (this.options.processStages === false) return 0"),
    );
  });

  it("keeps ordinary text search and native-CV availability independent of Feature 005 flags", async () => {
    const healthService = await readFile(
      resolve(
        process.cwd(),
        "src/backend/services/system/get-system-health.ts",
      ),
      "utf8",
    );
    const healthRoute = await readFile(
      resolve(process.cwd(), "src/app/api/health/route.ts"),
      "utf8",
    );
    expect(healthService).toContain("nativeCvImport: true");
    expect(healthService).toContain("ordinaryJobSearch: true");
    expect(healthService).toContain("imageSearchWorkerConfigured");
    expect(healthRoute).toContain("getSystemHealth");
  });
});
