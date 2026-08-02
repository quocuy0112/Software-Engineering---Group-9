import { NextResponse } from "next/server";
import { cvConfiguration } from "@/backend/cv/config";

export function GET() {
  const externalParserReady = Boolean(
    cvConfiguration.parser.adapter === "openai" &&
    cvConfiguration.parser.enabled &&
    cvConfiguration.parser.apiKey &&
    cvConfiguration.parser.privacyApproved,
  );
  return NextResponse.json({
    status: "ok",
    cv: {
      cleanupEnabled: cvConfiguration.cleanupEnabled,
      processingEnabled: cvConfiguration.workerEnabled,
      externalParserReady,
    },
  });
}
