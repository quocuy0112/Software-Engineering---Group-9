import { describe, expect, it } from "vitest";

import { CV_APPROVED_OPENAI_MODEL } from "@/backend/cv/config";
import { OpenAiCvParser } from "@/backend/cv/parsing/openai";

const liveEnabled = process.env.CV_OPENAI_LIVE_SYNTHETIC === "1";
const syntheticSegments = Object.freeze([
  Object.freeze({
    id: "synthetic-heading",
    kind: "heading" as const,
    text: "Synthetic Software Engineer",
  }),
  Object.freeze({
    id: "synthetic-experience",
    kind: "paragraph" as const,
    text: "Worked at Example Test Company from 2022 to 2024.",
  }),
  Object.freeze({
    id: "synthetic-skill",
    kind: "list-item" as const,
    text: "TypeScript",
  }),
]);

describe("opt-in synthetic-only live OpenAI CV smoke", () => {
  it("is network-off by default and exposes no runtime fixture override", () => {
    expect(process.env.CV_OPENAI_LIVE_SYNTHETIC ?? "0").toMatch(/^[01]$/u);
    expect(syntheticSegments.map((segment) => segment.id)).toEqual([
      "synthetic-heading",
      "synthetic-experience",
      "synthetic-skill",
    ]);
    expect(process.env).not.toHaveProperty("CV_OPENAI_LIVE_CV_PATH");
    expect(process.env).not.toHaveProperty("CV_OPENAI_LIVE_CV_TEXT");
  });

  it.skipIf(!liveEnabled)(
    "parses only the compiled synthetic fixture in an approved non-production project",
    async () => {
      expect(process.env.APP_ENV).not.toBe("production");
      expect(process.env.CV_OPENAI_SYNTHETIC_PROJECT_APPROVED).toBe("true");
      expect(process.env.CV_OPENAI_SYNTHETIC_PROJECT_ID).toMatch(
        /^proj_[A-Za-z0-9_-]+$/u,
      );
      const apiKey = process.env.OPENAI_API_KEY;
      expect(apiKey).toBeTruthy();
      if (!apiKey) throw new Error("SYNTHETIC_OPENAI_API_KEY_REQUIRED");

      const parser = new OpenAiCvParser({ apiKey });
      const result = await parser.parse({
        segments: syntheticSegments,
        safetyIdentifier: "synthetic_cv_004_live_smoke_00000001",
        deadline: new Date(Date.now() + 60_000),
      });

      expect(result.dispatch).toMatchObject({
        parserClass: "EXTERNAL_OPENAI",
        provider: "openai",
        model: CV_APPROVED_OPENAI_MODEL,
      });
      expect(result.output).toBeTypeOf("object");
    },
    65_000,
  );
});
