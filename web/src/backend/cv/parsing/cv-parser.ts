import "server-only";

import type { StoredCvSegment } from "@/backend/cv/extraction/extracted-segment-store";
import type { CvParserClass } from "@/shared/contracts/cv-import/common";

export type CvParserInput = Readonly<{
  segments: readonly StoredCvSegment[];
  safetyIdentifier?: string;
  deadline?: Date;
  signal?: AbortSignal;
}>;

export type CvParserDispatch = Readonly<{
  parserClass: CvParserClass;
  provider: string;
  model: string;
  inputVersion: "cv-segments-v1" | "cv-segments-v2";
  instructionVersion: "cv-extract-v1" | "cv-extract-v2";
  schemaVersion: "cv-draft-v1" | "cv-draft-v2";
}>;

export type CvParserResult = Readonly<{
  output: unknown;
  dispatch: CvParserDispatch;
  providerRequestId?: string;
}>;

export interface CvParser {
  readonly parserClass: CvParserClass;
  parse(input: CvParserInput): Promise<CvParserResult>;
}

export function cvParserInputVersion(input: CvParserInput) {
  return input.segments.some(
    (segment) =>
      "schemaVersion" in segment && segment.schemaVersion === "cv-segments-v2",
  )
    ? ("cv-segments-v2" as const)
    : ("cv-segments-v1" as const);
}
