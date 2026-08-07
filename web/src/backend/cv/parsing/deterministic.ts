import "server-only";

import {
  cvParserOutputSchema,
  cvParserOutputV2Schema,
} from "@/shared/contracts/cv-import/parser-output";
import {
  cvParserInputVersion,
  type CvParser,
  type CvParserInput,
} from "./cv-parser";

export class DeterministicCvParser implements CvParser {
  readonly parserClass = "DETERMINISTIC_INTERNAL" as const;

  constructor(
    input: Readonly<{ environment: string }> = {
      environment: process.env.NODE_ENV ?? "development",
    },
  ) {
    if (input.environment === "production")
      throw new Error("CV_DETERMINISTIC_PARSER_PRODUCTION_FORBIDDEN");
  }

  async parse(input: CvParserInput) {
    if (!input.segments.length) throw new Error("CV_PARSER_INPUT_EMPTY");
    const inputVersion = cvParserInputVersion(input);
    const proposalSegments =
      inputVersion === "cv-segments-v2"
        ? input.segments.filter(
            (segment) =>
              !("confidence" in segment) ||
              segment.confidence.level !== "LOW" ||
              ("source" in segment &&
                ["NATIVE", "NATIVE_AND_OCR"].includes(segment.source.method)),
          )
        : input.segments;
    const [heading, experience, skill] = [
      proposalSegments[0] ?? input.segments[0],
      proposalSegments[1] ?? proposalSegments[0] ?? input.segments[0],
      proposalSegments[2] ?? proposalSegments.at(-1) ?? input.segments[0],
    ];
    const fixtureShape = proposalSegments.some(
      (segment) => segment.id === "segment-heading-1",
    );
    const v1Output = cvParserOutputSchema.parse({
      schemaVersion: "cv-draft-v1",
      scalars: {
        headline: proposalSegments.length
          ? {
              value: fixtureShape
                ? "Synthetic Platform Engineer"
                : heading.text.slice(0, 200),
              confidence: 0.98,
              sourceSegmentIds: [heading.id],
            }
          : null,
        summary: null,
        phone: null,
        location: fixtureShape
          ? {
              value: "Test City",
              confidence: 0.75,
              sourceSegmentIds: [heading.id],
            }
          : null,
      },
      experiences: fixtureShape
        ? [
            {
              title: "Test Systems Engineer",
              company: "Example Laboratory",
              description: "Built deterministic test systems.",
              startDate: "2024-01-01",
              endDate: null,
              isCurrent: true,
              confidence: 0.96,
              sourceSegmentIds: [experience.id],
            },
          ]
        : [],
      education: [],
      skills: proposalSegments.length
        ? [
            {
              name: fixtureShape ? "TypeScript" : skill.text.slice(0, 80),
              confidence: 0.99,
              sourceSegmentIds: [skill.id],
            },
          ]
        : [],
      socialLinks: [],
    });
    const output =
      inputVersion === "cv-segments-v2"
        ? cvParserOutputV2Schema.parse({
            ...v1Output,
            schemaVersion: "cv-draft-v2",
            segmentEvidence: input.segments.flatMap((segment) => {
              if (!("source" in segment) || !("confidence" in segment))
                return [];
              const location =
                segment.source.unitKind === "PDF_PAGE"
                  ? `PDF page ${segment.source.pageNumber}`
                  : `DOCX body ${segment.source.bodyOrdinal}, image ${
                      (segment.source.imageOrdinal ?? 0) + 1
                    }`;
              return [
                {
                  segmentId: segment.id,
                  sourceMethod: segment.source.method,
                  sourceLocation: location,
                  confidenceLevel: segment.confidence.level,
                  warnings: segment.warnings,
                },
              ];
            }),
          })
        : v1Output;
    return Object.freeze({
      output,
      dispatch: Object.freeze({
        parserClass: this.parserClass,
        provider: "smarthire",
        model: "deterministic-v1",
        inputVersion,
        instructionVersion:
          inputVersion === "cv-segments-v2"
            ? ("cv-extract-v2" as const)
            : ("cv-extract-v1" as const),
        schemaVersion:
          inputVersion === "cv-segments-v2"
            ? ("cv-draft-v2" as const)
            : ("cv-draft-v1" as const),
      }),
    });
  }
}
