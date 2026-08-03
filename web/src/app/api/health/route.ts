import { NextResponse } from "next/server";
import { cvConfiguration, cvParserAvailability } from "@/backend/cv/config";

export function GET() {
  const parserAvailability = cvParserAvailability(cvConfiguration);
  return NextResponse.json({
    status: "ok",
    cv: {
      cleanupEnabled: cvConfiguration.cleanupEnabled,
      processingEnabled: cvConfiguration.workerEnabled,
      deterministicParserReady: parserAvailability.deterministic,
      externalParserReady: parserAvailability.external,
    },
  });
}
