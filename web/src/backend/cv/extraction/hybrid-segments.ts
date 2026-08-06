import "server-only";

import type {
  CvExtractionManifest,
  CvExtractionUnit,
} from "@/shared/contracts/ocr/cv-extraction";
import {
  CV_SEGMENT_SCHEMA_VERSION,
  cvSegmentV2Schema,
  type CvSegmentV2,
} from "@/shared/contracts/ocr/cv-segments-v2";
import {
  ocrRecognitionResultSchema,
  type OcrRecognitionResult,
} from "@/shared/contracts/ocr/recognition";

const OCR_REQUIRED = new Set([
  "OCR_REQUIRED_EMPTY",
  "OCR_REQUIRED_SPARSE",
  "OCR_REQUIRED_SUSPICIOUS",
  "ELIGIBLE_BODY_IMAGE",
]);

function comparisonText(text: string) {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("vi")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokenSimilarity(left: string, right: string) {
  const a = new Set(comparisonText(left).split(" ").filter(Boolean));
  const b = new Set(comparisonText(right).split(" ").filter(Boolean));
  if (!a.size && !b.size) return 1;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / new Set([...a, ...b]).size;
}

function visibleCharacters(text: string) {
  return text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
}

function sourceFor(
  unit: CvExtractionUnit,
  method: CvSegmentV2["source"]["method"],
) {
  return {
    method,
    unitKind: unit.kind,
    unitKey: unit.unitKey,
    pageNumber: unit.pageNumber,
    bodyOrdinal: unit.bodyOrdinal,
    imageOrdinal: unit.imageOrdinal,
    anchorQuality: unit.anchorQuality,
  } as const;
}

export type CvHybridUnitOutcome = Readonly<{
  unitKey: string;
  ordinal: number;
  status:
    | "NATIVE_SUCCEEDED"
    | "OCR_SUCCEEDED"
    | "LOW_CONFIDENCE"
    | "EXCLUDED"
    | "NON_TEXT";
  sourceMethod: "NATIVE" | "OCR" | "NATIVE_AND_OCR" | "NONE";
  segmentCount: number;
  deduplicatedSegmentCount: number;
  materialConflict: boolean;
  averageConfidence: number | null;
  minimumConfidence: number | null;
  recognizedCharacterCount: number;
  recognizedLineCount: number;
}>;

export function mergeHybridCvSegments(input: {
  manifest: CvExtractionManifest;
  recognizedUnits: ReadonlyMap<string, OcrRecognitionResult>;
  maximumUtf8Bytes: number;
}) {
  const expected = new Set(
    input.manifest.units
      .filter((unit) => OCR_REQUIRED.has(unit.classification))
      .map((unit) => unit.unitKey),
  );
  for (const key of expected)
    if (!input.recognizedUnits.has(key)) throw new Error("CV_OCR_UNIT_MISSING");
  for (const key of input.recognizedUnits.keys())
    if (!expected.has(key)) throw new Error("CV_OCR_UNIT_UNEXPECTED");

  const segments: CvSegmentV2[] = [];
  const units: CvHybridUnitOutcome[] = [];
  let utf8Bytes = 0;
  let nativeSegmentCount = 0;
  let ocrSegmentCount = 0;
  let lowConfidenceUnitCount = 0;
  let conflictUnitCount = 0;

  const push = (segment: Omit<CvSegmentV2, "order">) => {
    utf8Bytes += Buffer.byteLength(segment.text, "utf8");
    if (utf8Bytes > input.maximumUtf8Bytes)
      throw new Error("CV_SEGMENT_LIMIT_EXCEEDED");
    segments.push(
      cvSegmentV2Schema.parse({ ...segment, order: segments.length }),
    );
  };

  for (const unit of input.manifest.units) {
    const recognition = input.recognizedUnits.get(unit.unitKey);
    const result = recognition
      ? ocrRecognitionResultSchema.parse(recognition)
      : undefined;
    const nativeText = unit.nativeSegments
      .map((segment) => segment.text)
      .join(" ");
    const ocrText =
      result?.lines
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((line) => line.text.normalize("NFKC").trim())
        .filter(Boolean)
        .join("\n") ?? "";
    const exactDuplicate =
      Boolean(nativeText && ocrText) &&
      comparisonText(nativeText) === comparisonText(ocrText);
    const conflict =
      !exactDuplicate &&
      visibleCharacters(nativeText) >= 20 &&
      visibleCharacters(ocrText) >= 20 &&
      tokenSimilarity(nativeText, ocrText) < 0.6;
    const average = result?.summary.averageConfidence ?? null;
    const minimum = result?.summary.minimumConfidence ?? null;
    const confidenceLevel =
      average === null || average < 0.7
        ? "LOW"
        : average < 0.9
          ? "REVIEW"
          : "HIGH";
    const low = Boolean(result) && confidenceLevel === "LOW";
    if (low) lowConfidenceUnitCount += 1;
    if (conflict) conflictUnitCount += 1;

    if (exactDuplicate && result) {
      for (const [nativeIndex, native] of unit.nativeSegments.entries()) {
        const carriesOcrEvidence = nativeIndex === 0;
        push({
          schemaVersion: CV_SEGMENT_SCHEMA_VERSION,
          id: native.id,
          kind: native.kind,
          text: native.text,
          source: sourceFor(
            unit,
            carriesOcrEvidence ? "NATIVE_AND_OCR" : "NATIVE",
          ),
          confidence: carriesOcrEvidence
            ? { level: confidenceLevel, average, minimum }
            : { level: "NATIVE", average: null, minimum: null },
          versions: carriesOcrEvidence
            ? {
                eligibilityPolicy: "cv-ocr-eligibility-v1",
                confidencePolicy: "ocr-confidence-v1",
                deduplicationPolicy: "cv-segment-dedup-v1",
                ocrEngine: result.engine.name,
                ocrModel: result.engine.modelName,
              }
            : {
                eligibilityPolicy: "cv-ocr-eligibility-v1",
                confidencePolicy: "ocr-confidence-v1",
                deduplicationPolicy: "cv-segment-dedup-v1",
                ocrEngine: null,
                ocrModel: null,
              },
          warnings: carriesOcrEvidence ? ["DEDUPLICATED_WITH_NATIVE"] : [],
        });
        nativeSegmentCount += 1;
      }
      ocrSegmentCount += 1;
    } else {
      for (const native of unit.nativeSegments) {
        push({
          schemaVersion: CV_SEGMENT_SCHEMA_VERSION,
          id: native.id,
          kind: native.kind,
          text: native.text,
          source: sourceFor(unit, "NATIVE"),
          confidence: { level: "NATIVE", average: null, minimum: null },
          versions: {
            eligibilityPolicy: "cv-ocr-eligibility-v1",
            confidencePolicy: "ocr-confidence-v1",
            deduplicationPolicy: "cv-segment-dedup-v1",
            ocrEngine: null,
            ocrModel: null,
          },
          warnings: conflict ? ["MATERIAL_NATIVE_OCR_CONFLICT"] : [],
        });
        nativeSegmentCount += 1;
      }
      if (result && ocrText) {
        push({
          schemaVersion: CV_SEGMENT_SCHEMA_VERSION,
          id: `${unit.unitKey}-ocr-1`,
          kind: "paragraph",
          text: ocrText,
          source: sourceFor(unit, "OCR"),
          confidence: { level: confidenceLevel, average, minimum },
          versions: {
            eligibilityPolicy: "cv-ocr-eligibility-v1",
            confidencePolicy: "ocr-confidence-v1",
            deduplicationPolicy: "cv-segment-dedup-v1",
            ocrEngine: result.engine.name,
            ocrModel: result.engine.modelName,
          },
          warnings: [
            ...(low ? (["LOW_CONFIDENCE"] as const) : []),
            ...(conflict ? (["MATERIAL_NATIVE_OCR_CONFLICT"] as const) : []),
            ...(unit.anchorQuality === "APPROXIMATE"
              ? (["APPROXIMATE_ANCHOR"] as const)
              : []),
          ],
        });
        ocrSegmentCount += 1;
      }
    }

    const segmentCount = segments.filter(
      (segment) => segment.source.unitKey === unit.unitKey,
    ).length;
    units.push({
      unitKey: unit.unitKey,
      ordinal: unit.ordinal,
      status: result
        ? low
          ? "LOW_CONFIDENCE"
          : "OCR_SUCCEEDED"
        : unit.classification === "NATIVE_SUFFICIENT"
          ? "NATIVE_SUCCEEDED"
          : unit.classification === "NON_TEXT"
            ? "NON_TEXT"
            : "EXCLUDED",
      sourceMethod: exactDuplicate
        ? "NATIVE_AND_OCR"
        : result && unit.nativeSegments.length
          ? "NATIVE_AND_OCR"
          : result
            ? "OCR"
            : unit.nativeSegments.length
              ? "NATIVE"
              : "NONE",
      segmentCount,
      deduplicatedSegmentCount: exactDuplicate && result ? 1 : 0,
      materialConflict: conflict,
      averageConfidence: average,
      minimumConfidence: minimum,
      recognizedCharacterCount: visibleCharacters(ocrText),
      recognizedLineCount: result?.lines.length ?? 0,
    });
  }

  return Object.freeze({
    schemaVersion: CV_SEGMENT_SCHEMA_VERSION,
    segments: Object.freeze(segments),
    units: Object.freeze(units),
    nativeSegmentCount,
    ocrSegmentCount,
    lowConfidenceUnitCount,
    conflictUnitCount,
    utf8Bytes,
  });
}
