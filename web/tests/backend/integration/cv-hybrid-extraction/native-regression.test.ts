import { describe, expect, it } from "vitest";

import { IsolatedDocumentExtractor } from "@/backend/cv/extraction/document-extractor";
import { DeterministicCvParser } from "@/backend/cv/parsing/deterministic";
import {
  createSyntheticDocx,
  createSyntheticPdf,
} from "../../../helpers/cv-document-buffers";

describe("Feature 004 native extraction regression", () => {
  it.each([
    [
      "PDF" as const,
      createSyntheticPdf(
        "Senior platform engineer with extensive TypeScript, PostgreSQL, security, and distributed systems experience",
      ),
    ],
    [
      "DOCX" as const,
      createSyntheticDocx(
        "Senior platform engineer with extensive TypeScript, PostgreSQL, security, and distributed systems experience",
      ),
    ],
  ])(
    "keeps %s on byte-compatible v1 parser contracts",
    async (kind, source) => {
      const extracted = await new IsolatedDocumentExtractor().extract({
        kind,
        scanStatus: "CLEAN",
        source,
      });
      expect(extracted.manifest).toBeUndefined();
      expect(extracted.privateRasterWorkspacePath).toBeUndefined();
      const parsed = await new DeterministicCvParser({
        environment: "test",
      }).parse({
        segments: extracted.segments,
      });
      expect(parsed.dispatch).toMatchObject({
        inputVersion: "cv-segments-v1",
        instructionVersion: "cv-extract-v1",
        schemaVersion: "cv-draft-v1",
      });
    },
  );
});
