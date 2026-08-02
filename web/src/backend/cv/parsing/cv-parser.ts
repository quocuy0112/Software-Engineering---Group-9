import "server-only";

import type { ExtractedSegment } from "@/backend/cv/extraction/document-extractor";
import type { CvParserClass } from "@/shared/contracts/cv-import/common";

export type CvParserInput = Readonly<{
  segments: readonly ExtractedSegment[];
  safetyIdentifier?: string;
  deadline?: Date;
  signal?: AbortSignal;
}>;

export type CvParserDispatch = Readonly<{
  parserClass: CvParserClass;
  provider: string;
  model: string;
  inputVersion: "cv-segments-v1";
  instructionVersion: "cv-extract-v1";
  schemaVersion: "cv-draft-v1";
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
