import { describe, expect, it } from "vitest";

import { UnixOcrEngine } from "@/backend/ocr/unix-ocr-engine";

const engine = new UnixOcrEngine({
  socketPath: "/run/smarthire-ocr/ocr.sock",
  expectedEngineName: "paddleocr-onnx",
  expectedEngineVersion: "1.1.0",
  expectedModelName: "PP-OCRv6-medium",
});

const request = (input: { deadline: Date; computeDeadline: Date }) => ({
  attemptId: "attempt_fixture_001",
  purpose: "JOB_IMAGE_SEARCH" as const,
  image: {
    bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    width: 1,
    height: 1,
    decodedPixels: 1,
    sha256: new Uint8Array(32),
  },
  ...input,
  expectedModelManifestSha256: "a".repeat(64),
  signal: new AbortController().signal,
});

describe("Unix OCR dual deadlines", () => {
  it("rejects a request whose compute cutoff has already elapsed", async () => {
    await expect(
      engine.recognize(
        request({
          computeDeadline: new Date(Date.now() - 1),
          deadline: new Date(Date.now() + 1_000),
        }),
      ),
    ).rejects.toMatchObject({ code: "OCR_DEADLINE_EXCEEDED" });
  });

  it("rejects an invalid compute cutoff instead of extending transport time", async () => {
    await expect(
      engine.recognize(
        request({
          computeDeadline: new Date(Date.now() + 2_000),
          deadline: new Date(Date.now() + 1_000),
        }),
      ),
    ).rejects.toMatchObject({ code: "OCR_INPUT_REJECTED" });
  });
});
