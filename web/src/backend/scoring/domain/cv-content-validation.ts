export const MIN_CV_TEXT_CHARACTERS = 24;
export const MIN_CV_TEXT_WORDS = 5;

export type CvContentValidationCode =
  | "CV_TEXT_UNAVAILABLE"
  | "CV_TEXT_TOO_SHORT"
  | "CV_TEXT_INVALID";

export class CvContentValidationError extends Error {
  readonly name = "CvContentValidationError";

  constructor(readonly code: CvContentValidationCode) {
    super(code);
  }
}

export type ValidatedCvText = Readonly<{
  text: string;
  characterCount: number;
  wordCount: number;
}>;

function replaceControlCharacters(value: string): string {
  return Array.from(value, (character) => {
    const code = character.codePointAt(0) ?? 0;
    const isControlCharacter =
      code <= 0x08 ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f;
    return isControlCharacter ? " " : character;
  }).join("");
}

export function normalizeExtractedCvText(value: string): string {
  return replaceControlCharacters(value.normalize("NFKC"))
    .replace(/\r\n?/gu, "\n")
    .replace(/[ \t]+/gu, " ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function wordCount(value: string): number {
  return value.match(/[\p{L}\p{N}][\p{L}\p{N}'’+#./-]*/gu)?.length ?? 0;
}

export function validateExtractedCvText(value: string): ValidatedCvText {
  const text = normalizeExtractedCvText(value);
  if (!text) throw new CvContentValidationError("CV_TEXT_UNAVAILABLE");

  const words = wordCount(text);
  if (text.length < MIN_CV_TEXT_CHARACTERS || words < MIN_CV_TEXT_WORDS) {
    throw new CvContentValidationError("CV_TEXT_TOO_SHORT");
  }
  if (!/[\p{L}\p{N}]/u.test(text))
    throw new CvContentValidationError("CV_TEXT_INVALID");

  return Object.freeze({
    text,
    characterCount: text.length,
    wordCount: words,
  });
}
