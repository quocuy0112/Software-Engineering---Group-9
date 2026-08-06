import type {
  OcrPurpose,
  OcrRecognitionResult,
} from "@/shared/contracts/ocr/recognition";

export type NormalizedPng = Readonly<{
  bytes: Uint8Array;
  width: number;
  height: number;
  decodedPixels: number;
  sha256: Uint8Array;
}>;

export type OcrRecognitionRequest = Readonly<{
  attemptId: string;
  purpose: OcrPurpose;
  image: NormalizedPng;
  deadline: Date;
  expectedModelManifestSha256: string;
  signal: AbortSignal;
}>;

export class OcrEngineFailure extends Error {
  constructor(
    public readonly code:
      | "OCR_ENGINE_NOT_READY"
      | "OCR_MODEL_MISMATCH"
      | "OCR_DEADLINE_EXCEEDED"
      | "OCR_INPUT_REJECTED"
      | "OCR_OUTPUT_REJECTED"
      | "OCR_RECOGNITION_FAILED",
    public readonly retryable: boolean,
  ) {
    super(code);
    this.name = "OcrEngineFailure";
  }
}

export interface OcrEngine {
  assertReady(expectedModelManifestSha256: string): Promise<void>;
  recognize(input: OcrRecognitionRequest): Promise<OcrRecognitionResult>;
}
