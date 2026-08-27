import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { ClamAvScanner } from "../src/backend/cv/scanning/clamav.ts";
import {
  OCR_EXPECTED_ENGINE_VERSION,
  OCR_EXPECTED_MODEL_MANIFEST_SHA256,
} from "../src/backend/image-search/config.ts";
import { OpenAiSearchIntentInterpreter } from "../src/backend/image-search/interpretation/openai.ts";
import { SearchIntentSelectionPolicy } from "../src/backend/image-search/interpretation/selection-policy.ts";
import { SharpImageNormalizer } from "../src/backend/ocr/image-normalizer.ts";
import { UnixOcrEngine } from "../src/backend/ocr/unix-ocr-engine.ts";
import { OCR_PURPOSE_PROFILES } from "../src/backend/ocr/policies.ts";
import { IMAGE_SEARCH_ALLOWED_FIELDS } from "../src/shared/contracts/jobs/search-intent.ts";

const MAXIMUM_SOURCE_BYTES = 5_000_000;
const MAXIMUM_DECODED_PIXELS = 20_000_000;
const MAXIMUM_NORMALIZED_BYTES = 25 * 1024 * 1024;

function usage() {
  return `Usage:
  npm run image-search:inspect -- --image <poster.png> [options]

Options:
  --truth <truth.txt>  Calculate word accuracy against UTF-8 ground truth.
  --with-ai            Run the production OpenAI interpreter and local policy.
  --show-content       Include OCR text and proposal values in terminal output.
  --self-test          Test the inspector's deterministic scoring helpers.
  --help               Show this help.

This development-only command intentionally prints content only when
--show-content is present. Never use real personal or production material.`;
}

function parseArguments(argv) {
  const parsed = {
    image: null,
    truth: null,
    withAi: false,
    showContent: false,
    selfTest: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--image" || argument === "--truth") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--"))
        throw new Error(`${argument} requires a path.`);
      parsed[argument.slice(2)] = value;
      index += 1;
    } else if (argument === "--with-ai") parsed.withAi = true;
    else if (argument === "--show-content") parsed.showContent = true;
    else if (argument === "--self-test") parsed.selfTest = true;
    else if (argument === "--help" || argument === "-h") parsed.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return parsed;
}

async function* oneChunk(bytes) {
  yield bytes;
}

function sourceFormat(bytes) {
  if (
    bytes.byteLength >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
  )
    return "png";
  if (
    bytes.byteLength >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "jpeg";
  throw new Error("Only a matching static PNG or JPEG is supported.");
}

function detectLanguage(text) {
  const vietnamese =
    /[\u0102\u0103\u0110\u0111\u0128\u0129\u0168\u0169\u01A0-\u01B0\u1EA0-\u1EF9]/u.test(
      text,
    );
  const english =
    /\b(?:the|and|job|experience|skills?|location|salary|remote)\b/iu.test(
      text,
    );
  return vietnamese && english
    ? "BILINGUAL"
    : vietnamese
      ? "VI"
      : english
        ? "EN"
        : "UNKNOWN";
}

function words(value) {
  return (
    value
      .normalize("NFKC")
      .toLocaleLowerCase("vi")
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

function editDistance(left, right) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1)
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    previous = current;
  }
  return previous[right.length];
}

export function calculateWordAccuracy(truth, recognized) {
  const truthWords = words(truth);
  const recognizedWords = words(recognized);
  if (!truthWords.length) throw new Error("Ground truth must contain words.");
  const errors = editDistance(truthWords, recognizedWords);
  return {
    accuracyPercent:
      Math.round(
        Math.max(0, (truthWords.length - errors) / truthWords.length) * 10_000,
      ) / 100,
    wordErrorRatePercent:
      Math.round((errors / truthWords.length) * 10_000) / 100,
    truthWords: truthWords.length,
    recognizedWords: recognizedWords.length,
    editDistance: errors,
  };
}

function milliseconds(startedAt) {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}

function safeAiFailure(error) {
  return error instanceof Error &&
    ["INTERPRETER_INVALID_OUTPUT", "INTERPRETER_UNAVAILABLE"].includes(
      error.message,
    )
    ? error.message
    : "INTERPRETER_UNAVAILABLE";
}

function redactRawProposal(proposal) {
  return {
    id: proposal.id,
    field: proposal.field,
    confidence: proposal.confidence,
    basis: proposal.basis,
    content: "REDACTED; rerun with --show-content",
  };
}

function redactValidatedProposal(proposal) {
  return {
    id: proposal.id,
    field: proposal.field,
    confidence: proposal.confidence,
    basis: proposal.basis,
    selected: proposal.selected,
    selectionReason: proposal.selectionReason,
    content: "REDACTED; rerun with --show-content",
  };
}

async function inspect(input) {
  if (process.env.NODE_ENV === "production")
    throw new Error("The image-search inspector is disabled in production.");

  const absoluteImagePath = resolve(input.image);
  const source = await readFile(absoluteImagePath);
  if (source.byteLength < 1 || source.byteLength > MAXIMUM_SOURCE_BYTES)
    throw new Error(
      "The source image must be between 1 byte and 5,000,000 bytes.",
    );
  const declaredFormat = sourceFormat(source);
  const timings = {};

  let startedAt = performance.now();
  const scanner = new ClamAvScanner({
    socketPath: process.env.CV_CLAMD_SOCKET_PATH ?? "/run/clamav/clamd.sock",
    maximumBytes: MAXIMUM_SOURCE_BYTES,
  });
  const scan = await scanner.scan(oneChunk(source));
  timings.scan = milliseconds(startedAt);
  if (scan.outcome !== "CLEAN") throw new Error("MALWARE_DETECTED");

  startedAt = performance.now();
  const normalizer = new SharpImageNormalizer({
    assertCleanAssessment: async (_assessmentId, purpose) => {
      if (purpose !== "JOB_IMAGE_SEARCH" || scan.outcome !== "CLEAN")
        throw new Error("IMAGE_NORMALIZATION_REQUIRES_CLEAN_SCAN");
    },
  });
  const normalized = await normalizer.normalize({
    purpose: "JOB_IMAGE_SEARCH",
    cleanAssessmentId: `inspection-${randomUUID()}`,
    source: oneChunk(source),
    declaredFormat,
    maximumSourceBytes: MAXIMUM_SOURCE_BYTES,
    maximumDecodedPixels: MAXIMUM_DECODED_PIXELS,
    maximumOutputBytes: MAXIMUM_NORMALIZED_BYTES,
    signal: new AbortController().signal,
  });
  timings.normalize = milliseconds(startedAt);

  startedAt = performance.now();
  const ocr = new UnixOcrEngine({
    socketPath:
      process.env.OCR_ENGINE_SOCKET_PATH ?? "/run/smarthire-ocr/ocr.sock",
    expectedEngineName: "paddleocr-onnx",
    expectedEngineVersion: OCR_EXPECTED_ENGINE_VERSION,
    expectedModelName: "PP-OCRv6-medium",
  });
  await ocr.assertReady(OCR_EXPECTED_MODEL_MANIFEST_SHA256);
  const ocrDeadline = new Date(Date.now() + 10_000);
  const recognition = await ocr.recognize({
    attemptId: `inspect-${randomUUID()}`,
    purpose: "JOB_IMAGE_SEARCH",
    image: {
      bytes: normalized.bytes,
      width: normalized.width,
      height: normalized.height,
      decodedPixels: normalized.normalizedPixels,
      sha256: createHash("sha256").update(normalized.bytes).digest(),
    },
    deadline: ocrDeadline,
    computeDeadline: new Date(
      ocrDeadline.getTime() -
        OCR_PURPOSE_PROFILES.JOB_IMAGE_SEARCH.computeGraceMs,
    ),
    expectedModelManifestSha256: OCR_EXPECTED_MODEL_MANIFEST_SHA256,
    signal: new AbortController().signal,
  });
  timings.ocr = milliseconds(startedAt);
  const orderedLines = recognition.lines
    .slice()
    .sort((left, right) => left.order - right.order);
  const text = orderedLines
    .map((line) => line.text.normalize("NFKC").trim())
    .filter(Boolean)
    .join("\n");
  const language = detectLanguage(text);
  const wordAccuracy = input.truth
    ? calculateWordAccuracy(await readFile(resolve(input.truth), "utf8"), text)
    : null;

  let ai = null;
  if (input.withAi) {
    startedAt = performance.now();
    try {
      const interpreter = new OpenAiSearchIntentInterpreter({
        apiKey: process.env.OPENAI_API_KEY ?? "",
      });
      const rawProposals = await interpreter.interpret({
        text,
        language,
        purposeVersion: "job-image-search-purpose-v1",
        inputVersion: "search-ocr-text-v1",
        instructionVersion: "job-search-intent-v2",
        schemaVersion: "job-search-intent-v1",
        allowedFields: IMAGE_SEARCH_ALLOWED_FIELDS,
        safetyIdentifier: randomBytes(32).toString("base64url"),
        deadline: new Date(Date.now() + 4_000),
        signal: new AbortController().signal,
      });
      const validatedIntent =
        new SearchIntentSelectionPolicy().validateAndSelect({
          ocrText: text,
          language,
          proposals: rawProposals,
        });
      ai = {
        status: "SUCCEEDED",
        rawProposals: input.showContent
          ? rawProposals
          : rawProposals.map(redactRawProposal),
        validatedIntent: input.showContent
          ? validatedIntent
          : {
              ...validatedIntent,
              proposals: validatedIntent.proposals.map(redactValidatedProposal),
            },
      };
    } catch (error) {
      ai = { status: "FAILED", code: safeAiFailure(error) };
    }
    timings.aiAndPolicy = milliseconds(startedAt);
  }

  return {
    schemaVersion: "image-search-inspection-v1",
    warning:
      "Developer-only output. Do not use real personal or production material.",
    source: {
      path: absoluteImagePath,
      format: declaredFormat,
      bytes: source.byteLength,
    },
    scan: { outcome: scan.outcome, engineVersion: scan.engineVersion },
    normalization: {
      width: normalized.width,
      height: normalized.height,
      decodedPixels: normalized.normalizedPixels,
      autoOriented: normalized.autoOriented,
      metadataRemoved: normalized.metadataRemoved,
      rulesVersion: normalized.rulesVersion,
    },
    ocr: {
      engine: recognition.engine,
      summary: {
        ...recognition.summary,
        averageConfidencePercent:
          recognition.summary.averageConfidence === null
            ? null
            : Math.round(recognition.summary.averageConfidence * 10_000) / 100,
        note: "Model confidence is not measured accuracy. Use --truth for word accuracy.",
      },
      detectedLanguage: language,
      wordAccuracy,
      text: input.showContent ? text : "REDACTED; rerun with --show-content",
      lines: orderedLines.map((line) => ({
        order: line.order,
        confidence: line.confidence,
        confidencePercent: Math.round(line.confidence * 10_000) / 100,
        polygon: line.polygon,
        text: input.showContent
          ? line.text
          : "REDACTED; rerun with --show-content",
      })),
    },
    ai,
    timingsMs: timings,
  };
}

function runSelfTest() {
  const exact = calculateWordAccuracy(
    "Vị trí Senior TypeScript Engineer",
    "Vị trí Senior TypeScript Engineer",
  );
  const missing = calculateWordAccuracy(
    "Vị trí Senior TypeScript Engineer",
    "Vị trí Senior Engineer",
  );
  if (exact.accuracyPercent !== 100 || missing.accuracyPercent !== 80)
    throw new Error("Inspector scoring self-test failed.");
  return {
    status: "PASS",
    exactAccuracyPercent: exact.accuracyPercent,
    oneMissingWordAccuracyPercent: missing.accuracyPercent,
  };
}

async function main() {
  const input = parseArguments(process.argv.slice(2));
  if (input.help) {
    console.log(usage());
    return;
  }
  if (input.selfTest) {
    console.log(JSON.stringify(runSelfTest(), null, 2));
    return;
  }
  if (!input.image) throw new Error("--image is required.\n\n" + usage());
  console.log(JSON.stringify(await inspect(input), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      JSON.stringify({
        status: "FAILED",
        code: error instanceof Error ? error.message : "INSPECTION_FAILED",
      }),
    );
    process.exitCode = 1;
  });
}
