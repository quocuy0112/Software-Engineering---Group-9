import { request as httpRequest } from "node:http";

import {
  ocrEngineManifestSchema,
  ocrRecognitionResultSchema,
  type OcrRecognitionResult,
} from "@/shared/contracts/ocr/recognition";

import {
  OcrEngineFailure,
  type OcrEngine,
  type OcrRecognitionRequest,
} from "./ocr-engine";
import {
  OCR_MAXIMUM_DECODED_PIXELS,
  OCR_MAXIMUM_INPUT_BYTES,
} from "./policies";

type Options = Readonly<{
  socketPath: "/run/smarthire-ocr/ocr.sock";
  expectedEngineName: "paddleocr-onnx";
  expectedEngineVersion: "1.0.0";
  expectedModelName: "PP-OCRv6-medium";
  maximumResponseBytes?: number;
}>;

type HttpResult = Readonly<{
  statusCode: number;
  body: Uint8Array;
}>;

function boundedRequest(input: {
  socketPath: string;
  path: string;
  method: "GET" | "POST";
  headers?: Record<string, string | number>;
  body?: Uint8Array;
  deadline: Date;
  signal?: AbortSignal;
  maximumResponseBytes: number;
}): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const remaining = input.deadline.getTime() - Date.now();
    if (remaining <= 0 || input.signal?.aborted) {
      reject(new OcrEngineFailure("OCR_DEADLINE_EXCEEDED", true));
      return;
    }
    const request = httpRequest({
      socketPath: input.socketPath,
      path: input.path,
      method: input.method,
      headers: { Host: "localhost", Connection: "close", ...input.headers },
      timeout: remaining,
      agent: false,
    });
    const abort = () => request.destroy(new Error("OCR_ABORTED"));
    input.signal?.addEventListener("abort", abort, { once: true });
    request.once("timeout", () => request.destroy(new Error("OCR_TIMEOUT")));
    request.once("error", (error) => {
      input.signal?.removeEventListener("abort", abort);
      reject(
        new OcrEngineFailure(
          error.message === "OCR_TIMEOUT" || error.message === "OCR_ABORTED"
            ? "OCR_DEADLINE_EXCEEDED"
            : "OCR_ENGINE_NOT_READY",
          true,
        ),
      );
    });
    request.once("response", (response) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on("data", (chunk: Buffer) => {
        bytes += chunk.byteLength;
        if (bytes > input.maximumResponseBytes) {
          response.destroy(new Error("OCR_RESPONSE_TOO_LARGE"));
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      response.once("error", () =>
        reject(new OcrEngineFailure("OCR_OUTPUT_REJECTED", false)),
      );
      response.once("end", () => {
        input.signal?.removeEventListener("abort", abort);
        resolve({
          statusCode: response.statusCode ?? 500,
          body: Buffer.concat(chunks, bytes),
        });
      });
    });
    request.end(input.body);
  });
}

function parseJson(body: Uint8Array): unknown {
  try {
    return JSON.parse(Buffer.from(body).toString("utf8"));
  } catch {
    throw new OcrEngineFailure("OCR_OUTPUT_REJECTED", false);
  }
}

export class UnixOcrEngine implements OcrEngine {
  private readonly maximumResponseBytes: number;

  constructor(private readonly options: Options) {
    this.maximumResponseBytes = options.maximumResponseBytes ?? 256 * 1024;
  }

  async assertReady(expectedModelManifestSha256: string): Promise<void> {
    const result = await boundedRequest({
      socketPath: this.options.socketPath,
      path: "/health/ready",
      method: "GET",
      deadline: new Date(Date.now() + 2_000),
      maximumResponseBytes: 32 * 1024,
    });
    if (result.statusCode !== 200) {
      throw new OcrEngineFailure("OCR_ENGINE_NOT_READY", true);
    }
    const payload = parseJson(result.body) as Record<string, unknown>;
    const manifest = ocrEngineManifestSchema.safeParse(payload.engine);
    if (
      payload.status !== "ready" ||
      !manifest.success ||
      manifest.data.name !== this.options.expectedEngineName ||
      manifest.data.version !== this.options.expectedEngineVersion ||
      manifest.data.modelName !== this.options.expectedModelName ||
      manifest.data.modelManifestSha256 !== expectedModelManifestSha256
    ) {
      throw new OcrEngineFailure("OCR_MODEL_MISMATCH", false);
    }
  }

  async recognize(input: OcrRecognitionRequest): Promise<OcrRecognitionResult> {
    if (
      input.image.bytes.byteLength > OCR_MAXIMUM_INPUT_BYTES ||
      input.image.width < 1 ||
      input.image.height < 1 ||
      input.image.width * input.image.height !== input.image.decodedPixels ||
      input.image.decodedPixels > OCR_MAXIMUM_DECODED_PIXELS ||
      !Buffer.from(input.image.bytes.subarray(0, 8)).equals(
        Buffer.from("89504e470d0a1a0a", "hex"),
      )
    ) {
      throw new OcrEngineFailure("OCR_INPUT_REJECTED", false);
    }
    const result = await boundedRequest({
      socketPath: this.options.socketPath,
      path: "/v1/recognitions",
      method: "POST",
      deadline: input.deadline,
      signal: input.signal,
      maximumResponseBytes: this.maximumResponseBytes,
      body: input.image.bytes,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": input.image.bytes.byteLength,
        "X-OCR-Attempt-Id": input.attemptId,
        "X-OCR-Purpose": input.purpose,
        "X-OCR-Deadline": input.deadline.toISOString(),
        "X-OCR-Model-Manifest-SHA256": input.expectedModelManifestSha256,
      },
    });
    if (result.statusCode === 503) {
      throw new OcrEngineFailure("OCR_ENGINE_NOT_READY", true);
    }
    if (result.statusCode !== 200) {
      throw new OcrEngineFailure("OCR_RECOGNITION_FAILED", false);
    }
    const parsed = ocrRecognitionResultSchema.safeParse(parseJson(result.body));
    if (
      !parsed.success ||
      parsed.data.attemptId !== input.attemptId ||
      parsed.data.purpose !== input.purpose ||
      parsed.data.image.width !== input.image.width ||
      parsed.data.image.height !== input.image.height ||
      parsed.data.image.decodedPixels !== input.image.decodedPixels ||
      parsed.data.engine.name !== this.options.expectedEngineName ||
      parsed.data.engine.version !== this.options.expectedEngineVersion ||
      parsed.data.engine.modelName !== this.options.expectedModelName ||
      parsed.data.engine.modelManifestSha256 !==
        input.expectedModelManifestSha256
    ) {
      throw new OcrEngineFailure("OCR_OUTPUT_REJECTED", false);
    }
    return parsed.data;
  }
}
