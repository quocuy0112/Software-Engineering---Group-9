import { Readable } from "node:stream";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { SharpImageNormalizer } from "@/backend/ocr/image-normalizer";

async function jpegWithOrientation(): Promise<Buffer> {
  return sharp({
    create: {
      width: 4,
      height: 2,
      channels: 3,
      background: { r: 20, g: 40, b: 60 },
    },
  })
    .withMetadata({ orientation: 6, density: 144 })
    .jpeg()
    .toBuffer();
}

function request(bytes: Buffer, overrides: Record<string, unknown> = {}) {
  return {
    purpose: "JOB_IMAGE_SEARCH" as const,
    cleanAssessmentId: "clean-assessment-1",
    source: Readable.from([bytes.subarray(0, 5), bytes.subarray(5)]),
    declaredFormat: "jpeg" as const,
    maximumSourceBytes: 5_000_000,
    maximumDecodedPixels: 20_000_000,
    maximumOutputBytes: 25 * 1024 * 1024,
    signal: new AbortController().signal,
    ...overrides,
  };
}

describe("SharpImageNormalizer", () => {
  it("requires a persisted clean scan before decoding", async () => {
    const source = await jpegWithOrientation();
    const normalizer = new SharpImageNormalizer({
      assertCleanAssessment: vi
        .fn()
        .mockRejectedValue(new Error("IMAGE_CLEAN_ASSESSMENT_REQUIRED")),
    });
    await expect(normalizer.normalize(request(source))).rejects.toThrow(
      "IMAGE_CLEAN_ASSESSMENT_REQUIRED",
    );
  });

  it("auto-orients, flattens, converts to sRGB, strips metadata, and emits one PNG frame", async () => {
    const source = await jpegWithOrientation();
    const assertCleanAssessment = vi.fn().mockResolvedValue(undefined);
    const normalizer = new SharpImageNormalizer({ assertCleanAssessment });
    const result = await normalizer.normalize(request(source));
    expect(assertCleanAssessment).toHaveBeenCalledWith(
      "clean-assessment-1",
      "JOB_IMAGE_SEARCH",
    );
    expect(result).toMatchObject({
      format: "png",
      sourceFormat: "jpeg",
      width: 2,
      height: 4,
      sourceDecodedPixels: 8,
      normalizedPixels: 8,
      frameCount: 1,
      metadataRemoved: true,
      autoOriented: true,
      downscaled: false,
      normalizer: "sharp",
      normalizerVersion: "0.35.3",
      rulesVersion: "search-image-normalize-v2",
    });
    const metadata = await sharp(result.bytes).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.pages ?? 1).toBe(1);
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });

  it("downscales large job-search screenshots without enlarging small inputs", async () => {
    const source = await sharp({
      create: {
        width: 2_239,
        height: 1_425,
        channels: 3,
        background: { r: 245, g: 245, b: 245 },
      },
    })
      .png()
      .toBuffer();
    const normalizer = new SharpImageNormalizer({
      assertCleanAssessment: async () => undefined,
    });

    const result = await normalizer.normalize(
      request(source, {
        declaredFormat: "png",
        source: Readable.from([source]),
      }),
    );

    expect(result).toMatchObject({
      width: 1_600,
      height: 1_018,
      sourceDecodedPixels: 2_239 * 1_425,
      normalizedPixels: 1_600 * 1_018,
      downscaled: true,
      rulesVersion: "search-image-normalize-v2",
    });
  });

  it("rejects signature/decoder disagreement, trailing polyglot bytes, and decoded-pixel excess", async () => {
    const source = await jpegWithOrientation();
    const normalizer = new SharpImageNormalizer({
      assertCleanAssessment: async () => undefined,
    });
    await expect(
      normalizer.normalize(
        request(source, {
          declaredFormat: "png",
          source: Readable.from([source]),
        }),
      ),
    ).rejects.toThrow("IMAGE_FORMAT_MISMATCH");
    await expect(
      normalizer.normalize(
        request(Buffer.concat([source, Buffer.from("<script>")])),
      ),
    ).rejects.toThrow("IMAGE_TRAILING_BYTES_REJECTED");
    await expect(
      normalizer.normalize(request(source, { maximumDecodedPixels: 4 })),
    ).rejects.toThrow("IMAGE_PIXEL_LIMIT_EXCEEDED");
  });

  it("rejects source/output byte overflow and aborted operations", async () => {
    const source = await jpegWithOrientation();
    const normalizer = new SharpImageNormalizer({
      assertCleanAssessment: async () => undefined,
    });
    await expect(
      normalizer.normalize(request(source, { maximumSourceBytes: 4 })),
    ).rejects.toThrow("IMAGE_SOURCE_TOO_LARGE");
    const controller = new AbortController();
    controller.abort();
    await expect(
      normalizer.normalize(request(source, { signal: controller.signal })),
    ).rejects.toThrow("IMAGE_NORMALIZATION_ABORTED");
  });
});
