import "server-only";

import { cvParserOutputSchema } from "@/shared/contracts/cv-import/parser-output";
import type { CvParser, CvParserInput } from "./cv-parser";

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
    const [heading, experience, skill] = [
      input.segments[0],
      input.segments[1] ?? input.segments[0],
      input.segments[2] ?? input.segments.at(-1) ?? input.segments[0],
    ];
    const fixtureShape = input.segments.some(
      (segment) => segment.id === "segment-heading-1",
    );
    const output = cvParserOutputSchema.parse({
      schemaVersion: "cv-draft-v1",
      scalars: {
        headline: {
          value: fixtureShape
            ? "Synthetic Platform Engineer"
            : heading.text.slice(0, 200),
          confidence: 0.98,
          sourceSegmentIds: [heading.id],
        },
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
      skills: [
        {
          name: fixtureShape ? "TypeScript" : skill.text.slice(0, 80),
          confidence: 0.99,
          sourceSegmentIds: [skill.id],
        },
      ],
      socialLinks: [],
    });
    return Object.freeze({
      output,
      dispatch: Object.freeze({
        parserClass: this.parserClass,
        provider: "smarthire",
        model: "deterministic-v1",
        inputVersion: "cv-segments-v1" as const,
        instructionVersion: "cv-extract-v1" as const,
        schemaVersion: "cv-draft-v1" as const,
      }),
    });
  }
}
