import { Buffer } from "node:buffer";
import sharp, { type Metadata, type OutputInfo } from "sharp";

const JOB_IMAGE_SEARCH_MAX_DIMENSION = 1_600;

export type ImageNormalizationPurpose = "DOCX_BODY_IMAGE" | "JOB_IMAGE_SEARCH";

export type ImageNormalizationRequest = Readonly<{
  purpose: ImageNormalizationPurpose;
  cleanAssessmentId: string;
  source: AsyncIterable<Uint8Array>;
  declaredFormat: "png" | "jpeg";
  maximumSourceBytes: number;
  maximumDecodedPixels: number;
  maximumOutputBytes: number;
  signal: AbortSignal;
}>;

export type ImageNormalizationResult = Readonly<{
  format: "png";
  bytes: Uint8Array;
  sourceFormat: "png" | "jpeg";
  width: number;
  height: number;
  sourceDecodedPixels: number;
  normalizedPixels: number;
  frameCount: 1;
  metadataRemoved: true;
  autoOriented: boolean;
  downscaled: boolean;
  normalizer: "sharp";
  normalizerVersion: "0.35.3";
  rulesVersion: "search-image-normalize-v2" | "docx-image-normalize-v1";
}>;

type Dependencies = Readonly<{
  assertCleanAssessment(
    assessmentId: string,
    purpose: ImageNormalizationPurpose,
  ): Promise<void>;
}>;

export interface ImageNormalizer {
  normalize(
    input: ImageNormalizationRequest,
  ): Promise<ImageNormalizationResult>;
}

function failure(code: string): Error {
  return new Error(code);
}

async function readBounded(
  source: AsyncIterable<Uint8Array>,
  maximumBytes: number,
  signal: AbortSignal,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of source) {
    if (signal.aborted) throw failure("IMAGE_NORMALIZATION_ABORTED");
    bytes += chunk.byteLength;
    if (bytes > maximumBytes) throw failure("IMAGE_SOURCE_TOO_LARGE");
    chunks.push(Buffer.from(chunk));
  }
  if (bytes === 0) throw failure("IMAGE_SOURCE_EMPTY");
  return Buffer.concat(chunks, bytes);
}

function identifyStrictStaticImage(bytes: Buffer): "png" | "jpeg" {
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (png) {
    const iend = Buffer.from("0000000049454e44ae426082", "hex");
    if (bytes.length < 20 || !bytes.subarray(-12).equals(iend)) {
      throw failure("IMAGE_TRAILING_BYTES_REJECTED");
    }
    return "png";
  }
  const jpeg = bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8;
  if (jpeg) {
    if (bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
      throw failure("IMAGE_TRAILING_BYTES_REJECTED");
    }
    return "jpeg";
  }
  throw failure("IMAGE_FORMAT_UNSUPPORTED");
}

export class SharpImageNormalizer implements ImageNormalizer {
  constructor(private readonly dependencies: Dependencies) {}

  async normalize(
    input: ImageNormalizationRequest,
  ): Promise<ImageNormalizationResult> {
    if (input.signal.aborted) throw failure("IMAGE_NORMALIZATION_ABORTED");
    await this.dependencies.assertCleanAssessment(
      input.cleanAssessmentId,
      input.purpose,
    );
    const source = await readBounded(
      input.source,
      input.maximumSourceBytes,
      input.signal,
    );
    const sourceFormat = identifyStrictStaticImage(source);
    if (sourceFormat !== input.declaredFormat) {
      throw failure("IMAGE_FORMAT_MISMATCH");
    }
    let metadata: Metadata;
    try {
      metadata = await sharp(source, {
        animated: true,
        failOn: "error",
        limitInputPixels: false,
      }).metadata();
    } catch {
      throw failure("IMAGE_DECODE_REJECTED");
    }
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const sourceDecodedPixels = width * height;
    if (
      width < 1 ||
      height < 1 ||
      sourceDecodedPixels > input.maximumDecodedPixels
    ) {
      throw failure("IMAGE_PIXEL_LIMIT_EXCEEDED");
    }
    if (
      (metadata.pages ?? 1) !== 1 ||
      (metadata.pageHeight ?? height) !== height
    ) {
      throw failure("IMAGE_ANIMATION_REJECTED");
    }
    const autoOriented = ![undefined, 1].includes(metadata.orientation);
    let result: { data: Buffer; info: OutputInfo };
    try {
      let pipeline = sharp(source, {
        animated: false,
        failOn: "error",
        limitInputPixels: input.maximumDecodedPixels,
      })
        .rotate()
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .toColourspace("srgb");
      if (input.purpose === "JOB_IMAGE_SEARCH") {
        pipeline = pipeline.resize({
          width: JOB_IMAGE_SEARCH_MAX_DIMENSION,
          height: JOB_IMAGE_SEARCH_MAX_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos3,
        });
      }
      result = await pipeline
        .png({ compressionLevel: 9, adaptiveFiltering: false })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw failure("IMAGE_DECODE_REJECTED");
    }
    if (input.signal.aborted) throw failure("IMAGE_NORMALIZATION_ABORTED");
    if (result.data.byteLength > input.maximumOutputBytes) {
      throw failure("IMAGE_OUTPUT_TOO_LARGE");
    }
    const normalizedPixels = result.info.width * result.info.height;
    return {
      format: "png",
      bytes: result.data,
      sourceFormat,
      width: result.info.width,
      height: result.info.height,
      sourceDecodedPixels,
      normalizedPixels,
      frameCount: 1,
      metadataRemoved: true,
      autoOriented,
      downscaled: normalizedPixels < sourceDecodedPixels,
      normalizer: "sharp",
      normalizerVersion: "0.35.3",
      rulesVersion:
        input.purpose === "JOB_IMAGE_SEARCH"
          ? "search-image-normalize-v2"
          : "docx-image-normalize-v1",
    };
  }
}
