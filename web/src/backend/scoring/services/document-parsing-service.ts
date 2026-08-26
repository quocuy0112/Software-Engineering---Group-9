import type { ParseStatus } from "@/shared/contracts/scoring";

export type ParsedScoringDocument = Readonly<{
  text: string;
  status: ParseStatus;
}>;

export class DocumentParsingService {
  constructor(private readonly parserVersion = "parser-v1") {}

  parse(input: { text: string; snapshotVersion: string; processingMilliseconds?: number; failed?: boolean }): ParsedScoringDocument {
    const statusCode = input.failed
      ? "FAILED"
      : input.text.trim().length === 0
        ? "PARSED_WITH_ERRORS"
        : "PARSED_SUCCESSFULLY";
    const label = statusCode === "PARSED_SUCCESSFULLY"
      ? "Parsed successfully"
      : statusCode === "PARSED_WITH_ERRORS"
        ? "Parsed with errors"
        : "Failed";
    return {
      text: input.failed ? "" : input.text,
      status: {
        code: statusCode,
        label,
        parserVersion: this.parserVersion,
        processingMilliseconds: Math.max(0, Math.trunc(input.processingMilliseconds ?? 0)),
        snapshotVersion: input.snapshotVersion,
      },
    };
  }
}
