import "server-only";
import sanitizeHtml from "sanitize-html";

export type PlainTextFieldPolicy = {
  field: string;
  maxCodePoints: number;
  required?: boolean;
  multiline?: boolean;
};

export type PlainTextWarning = {
  field: string;
  code: "SANITIZED_TO_EMPTY";
};

export type PlainTextNormalizationResult = {
  value: string | null;
  warnings: PlainTextWarning[];
};

export class PlainTextNormalizationError extends Error {
  constructor(
    readonly field: string,
    readonly code: "REQUIRED" | "TOO_LONG" | "INVALID_VALUE",
  ) {
    super(`PLAIN_TEXT_${code}`);
  }
}

const forbiddenEntity = /&(?:lt|gt|#0*60|#x0*3c|#0*62|#x0*3e);?/gi;

function stripUnsafeControls(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return !(
        code <= 0x08 ||
        code === 0x0b ||
        code === 0x0c ||
        (code >= 0x0e && code <= 0x1f) ||
        (code >= 0x7f && code <= 0x9f)
      );
    })
    .join("");
}

function normalizeWhitespace(value: string, multiline: boolean): string {
  const withoutControls = stripUnsafeControls(value);
  if (!multiline) return withoutControls.replace(/\s+/gu, " ").trim();
  return withoutControls
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/gu, " ").trim())
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export class PlainTextNormalizer {
  normalize(
    input: string | null | undefined,
    policy: PlainTextFieldPolicy,
  ): PlainTextNormalizationResult {
    if (
      !policy.field ||
      !Number.isSafeInteger(policy.maxCodePoints) ||
      policy.maxCodePoints < 1
    ) {
      throw new PlainTextNormalizationError(
        policy.field || "field",
        "INVALID_VALUE",
      );
    }

    const original = input ?? "";
    if (typeof original !== "string") {
      throw new PlainTextNormalizationError(policy.field, "INVALID_VALUE");
    }
    const normalized = original.normalize("NFKC");
    const sanitized = sanitizeHtml(normalized, {
      allowedTags: [],
      allowedAttributes: {},
      disallowedTagsMode: "discard",
      nonTextTags: ["script", "style", "textarea", "option", "noscript"],
    })
      .replace(forbiddenEntity, " ")
      .replace(/[<>]/gu, " ");
    const value = normalizeWhitespace(sanitized, policy.multiline ?? false);

    if (!value) {
      if (policy.required) {
        throw new PlainTextNormalizationError(policy.field, "REQUIRED");
      }
      return {
        value: null,
        warnings: original.trim()
          ? [{ field: policy.field, code: "SANITIZED_TO_EMPTY" }]
          : [],
      };
    }
    if (Array.from(value).length > policy.maxCodePoints) {
      throw new PlainTextNormalizationError(policy.field, "TOO_LONG");
    }
    return { value, warnings: [] };
  }
}
