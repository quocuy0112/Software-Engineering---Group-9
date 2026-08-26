import "server-only";

import { z } from "zod";
import { logCvClassificationProviderFailure } from "@/backend/cv/upload-observability";
import { scoringProviderConfig } from "./config";

export type CvClassificationInput = Readonly<{
  cvText: string;
}>;

export type CvClassificationResult = Readonly<{
  isCv: boolean;
  confidence: number;
  reason?: string;
  source: "AI" | "DETERMINISTIC_FALLBACK";
  providerFailureCode?: CvClassificationFailureCode;
}>;

export type CvClassificationTransport = (
  input: CvClassificationInput,
) => Promise<unknown>;

export type CvClassificationFailureCode =
  | "CV_CLASSIFICATION_TIMEOUT"
  | "CV_CLASSIFICATION_UNAVAILABLE"
  | "CV_CLASSIFICATION_MALFORMED"
  | "CV_CLASSIFICATION_NOT_CONFIGURED";

export class CvClassificationProviderError extends Error {
  readonly name = "CvClassificationProviderError";

  constructor(
    readonly code: CvClassificationFailureCode,
    readonly transient = false,
  ) {
    super(code);
  }
}

const modernClassificationSchema = z
  .object({
    is_valid_cv: z.boolean(),
    confidence: z.number().min(0).max(100),
    reason: z.string().trim().max(300).optional(),
  })
  .strict();

const legacyClassificationSchema = z
  .object({
    is_cv: z.boolean(),
    confidence: z.number().min(0).max(1),
    reason: z.string().trim().max(300).optional(),
  })
  .strict();

export const CV_CLASSIFICATION_MIN_CONFIDENCE = 0.7;
export const CV_CLASSIFICATION_CORROBORATED_MIN_CONFIDENCE = 0.55;
export const CV_STRONG_STRUCTURAL_CONFIDENCE = 0.88;

export function isConfidentCvClassification(
  result: Pick<CvClassificationResult, "isCv" | "confidence">,
): boolean {
  return result.isCv && result.confidence >= CV_CLASSIFICATION_MIN_CONFIDENCE;
}

const CV_SECTION_PATTERNS = [
  /\b(?:resume|curriculum vitae|so yeu ly lich)\b/u,
  /\b(?:work experience|professional experience|employment history|career history|kinh nghiem(?: lam viec)?|qua trinh cong tac|lich su lam viec)\b/u,
  /\b(?:education|academic background|qualifications|hoc van|dao tao)\b/u,
  /\b(?:technical skills|core competencies|competencies|skills|ky nang|nang luc|chuyen mon)\b/u,
  /\b(?:professional summary|career objective|objective|about me|personal profile|muc tieu nghe nghiep|gioi thieu ban than)\b/u,
  /\b(?:project experience|projects|du an)\b/u,
  /\b(?:certifications?|certificates?|licenses?|awards?|chung chi|giai thuong)\b/u,
  /\b(?:languages?|ngoai ngu)\b/u,
  /\b(?:volunteering|activities|hoat dong)\b/u,
] as const;

function searchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[đĐ]/gu, (character) => (character === "Đ" ? "D" : "d"))
    .toLocaleLowerCase("en-US");
}

function structuralCvSignals(value: string) {
  const text = searchText(value);
  const lines = text
    .split(/\n+/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const openingText = lines.slice(0, 12).join("\n");
  const hasNonCvDocumentHeading =
    /\b(?:project|business|technical|research) proposal\b/u.test(openingText) ||
    /\b(?:project plan|weekly report|status report|meeting minutes|requirements specification|software requirements|service agreement|employment contract|invoice|terms and conditions)\b/u.test(
      openingText,
    ) ||
    /\b(?:de xuat du an|ke hoach du an|bao cao tuan|bao cao tien do|bien ban hop|tai lieu yeu cau|hop dong|hoa don)\b/u.test(
      openingText,
    );
  const sections = CV_SECTION_PATTERNS.filter((pattern) => pattern.test(text));
  const headingSections = CV_SECTION_PATTERNS.filter((pattern) =>
    lines.some(
      (line) =>
        line.length <= 80 &&
        (line.match(/[\p{L}\p{N}]+/gu)?.length ?? 0) <= 10 &&
        pattern.test(line),
    ),
  );
  const hasContact =
    /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/u.test(text) ||
    /\b(?:linkedin\.com|github\.com|portfolio|dien thoai|phone|mobile)\b/u.test(
      text,
    ) ||
    /(?:\+?84|0)\s*(?:\d[\s().-]*){9,10}\b/u.test(text);
  const hasCareerDateRange =
    /\b(?:19|20)\d{2}\s*(?:-|–|—|to|den)\s*(?:present|current|now|nay|(?:19|20)\d{2})\b/u.test(
      text,
    ) ||
    /\b(?:0?[1-9]|1[0-2])[/.](?:19|20)?\d{2}\s*(?:-|–|—|to|den)\s*(?:present|current|now|nay|(?:0?[1-9]|1[0-2])[/.](?:19|20)?\d{2})\b/u.test(
      text,
    );
  const hasCareerRole =
    /\b(?:developer|engineer|designer|manager|analyst|accountant|specialist|intern|architect|consultant|lecturer|teacher|technician|assistant|director|sales|marketing|ke toan|ky su|nhan vien|chuyen vien|quan ly|thuc tap)\b/u.test(
      text,
    );
  const supportCount = [hasContact, hasCareerDateRange, hasCareerRole].filter(
    Boolean,
  ).length;
  const sectionCount = sections.length;
  const headingSectionCount = headingSections.length;
  const isCv =
    !hasNonCvDocumentHeading &&
    ((headingSectionCount >= 2 &&
      (hasContact || hasCareerRole) &&
      supportCount >= 2) ||
      (sectionCount >= 3 && (hasContact || hasCareerRole)) ||
      (sectionCount >= 1 && supportCount === 3));
  const confidence = isCv
    ? Math.min(
        0.97,
        0.58 +
          sectionCount * 0.06 +
          headingSectionCount * 0.05 +
          supportCount * 0.04,
      )
    : 0.2;

  return Object.freeze({
    isCv,
    confidence,
    sectionCount,
    headingSectionCount,
    hasContact,
    hasCareerDateRange,
    hasCareerRole,
    hasNonCvDocumentHeading,
  });
}

export function deterministicCvClassification(
  input: CvClassificationInput,
  providerFailureCode?: CvClassificationFailureCode,
): CvClassificationResult {
  const signals = structuralCvSignals(input.cvText);
  return Object.freeze({
    isCv: signals.isCv,
    confidence: signals.confidence,
    reason: signals.isCv
      ? "The text contains multiple independent CV sections and career-history signals."
      : "The text does not contain enough independent CV structure and career-history signals.",
    source: "DETERMINISTIC_FALLBACK",
    ...(providerFailureCode ? { providerFailureCode } : {}),
  });
}

export type CvClassificationDecisionBasis =
  | "CLASSIFIER_CONFIDENT"
  | "CLASSIFIER_CORROBORATED"
  | "STRONG_STRUCTURAL_EVIDENCE"
  | "REJECTED";

export type CvClassificationDecision = Readonly<{
  accepted: boolean;
  basis: CvClassificationDecisionBasis;
  structuralClassification: CvClassificationResult;
}>;

/**
 * A probabilistic classifier must not be a single point of failure for a
 * candidate. Strong, independently measured CV structure can rescue a model
 * false-negative, while weak or unrelated documents still require a positive
 * classifier result at the normal confidence threshold.
 */
export function decideCvClassification(input: {
  cvText: string;
  classification: CvClassificationResult;
}): CvClassificationDecision {
  const structuralSignals = structuralCvSignals(input.cvText);
  const structuralClassification = deterministicCvClassification({
    cvText: input.cvText,
  });
  let basis: CvClassificationDecisionBasis = "REJECTED";
  if (isConfidentCvClassification(input.classification)) {
    basis = "CLASSIFIER_CONFIDENT";
  } else if (
    input.classification.isCv &&
    input.classification.confidence >=
      CV_CLASSIFICATION_CORROBORATED_MIN_CONFIDENCE &&
    structuralClassification.isCv
  ) {
    basis = "CLASSIFIER_CORROBORATED";
  } else if (
    structuralClassification.isCv &&
    structuralClassification.confidence >= CV_STRONG_STRUCTURAL_CONFIDENCE &&
    structuralSignals.sectionCount >= 2 &&
    ((structuralSignals.hasContact &&
      (structuralSignals.hasCareerRole ||
        structuralSignals.hasCareerDateRange)) ||
      (structuralSignals.hasCareerRole && structuralSignals.hasCareerDateRange))
  ) {
    basis = "STRONG_STRUCTURAL_EVIDENCE";
  }
  return Object.freeze({
    accepted: basis !== "REJECTED",
    basis,
    structuralClassification,
  });
}

function normalizedResult(input: {
  isCv: boolean;
  confidence: number;
  reason?: string;
  source: "AI" | "DETERMINISTIC_FALLBACK";
  providerFailureCode?: CvClassificationFailureCode;
}): CvClassificationResult {
  return Object.freeze({
    isCv: input.isCv,
    confidence: input.confidence,
    ...(input.reason ? { reason: input.reason.slice(0, 300) } : {}),
    source: input.source,
    ...(input.providerFailureCode
      ? { providerFailureCode: input.providerFailureCode }
      : {}),
  });
}

function percentageConfidence(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 100)
    throw new CvClassificationProviderError(
      "CV_CLASSIFICATION_MALFORMED",
      true,
    );
  return value > 1 ? value / 100 : value;
}

function responseText(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const record = body as {
    output_text?: unknown;
    output?: ReadonlyArray<{
      content?: ReadonlyArray<{ type?: unknown; text?: unknown }>;
    }>;
  };
  if (typeof record.output_text === "string" && record.output_text.trim())
    return record.output_text.trim();
  return (
    record.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === undefined || item.type === "output_text")
      .map((item) => (typeof item.text === "string" ? item.text : ""))
      .join("")
      .trim() ?? ""
  );
}

function parseClassification(value: unknown): CvClassificationResult {
  const text = responseText(value);
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new CvClassificationProviderError(
      "CV_CLASSIFICATION_MALFORMED",
      true,
    );
  }
  const modern = modernClassificationSchema.safeParse(decoded);
  if (modern.success) {
    return normalizedResult({
      isCv: modern.data.is_valid_cv,
      confidence: modern.data.confidence / 100,
      reason: modern.data.reason,
      source: "AI",
    });
  }
  const legacy = legacyClassificationSchema.safeParse(decoded);
  if (legacy.success) {
    return normalizedResult({
      isCv: legacy.data.is_cv,
      confidence: legacy.data.confidence,
      reason: legacy.data.reason,
      source: "AI",
    });
  }
  throw new CvClassificationProviderError("CV_CLASSIFICATION_MALFORMED", true);
}

function normalizeClassificationResponse(
  value: unknown,
): CvClassificationResult {
  const modern = modernClassificationSchema.safeParse(value);
  if (modern.success) {
    return normalizedResult({
      isCv: modern.data.is_valid_cv,
      confidence: modern.data.confidence / 100,
      reason: modern.data.reason,
      source: "AI",
    });
  }
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as { isCv?: unknown }).isCv === "boolean" &&
    typeof (value as { confidence?: unknown }).confidence === "number"
  ) {
    const direct = value as {
      isCv: boolean;
      confidence: number;
      source?: unknown;
      reason?: unknown;
    };
    return normalizedResult({
      isCv: direct.isCv,
      confidence: percentageConfidence(direct.confidence),
      reason:
        typeof direct.reason === "string" ? direct.reason.trim() : undefined,
      source:
        direct.source === "DETERMINISTIC_FALLBACK"
          ? "DETERMINISTIC_FALLBACK"
          : "AI",
    });
  }
  return parseClassification(value);
}

export function buildCvClassificationRequestBody(
  input: CvClassificationInput,
): Record<string, unknown> {
  return {
    model: scoringProviderConfig.classificationModelVersion,
    background: false,
    store: false,
    stream: false,
    max_output_tokens: 160,
    instructions:
      "You are a multilingual document classifier. Determine whether the extracted text plausibly comes from a genuine CV or resume. Treat English, Vietnamese, bilingual, short, anonymized, and design-heavy CVs as valid when they contain credible career structure such as contact/profile details, work history, education, skills, projects, certifications, or career objectives. Extraction may lose columns, bullets, accents, and heading order, so do not require the words CV or Resume and do not require every section. Reject documents that are clearly invoices, contracts, project proposals, project plans, reports, articles, forms, or unrelated prose, even when they discuss resumes, education, experience, or skills. When a document is plausibly a CV but incomplete, set is_valid_cv to true and lower confidence instead of returning a false-negative. Respond only with JSON using is_valid_cv (boolean), confidence (number from 0 to 100), and a reason under 120 characters. Do not score the candidate and do not infer sensitive attributes.",
    input: input.cvText.slice(0, 12_000),
    text: {
      format: {
        type: "json_schema",
        name: "cv_classification",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["is_valid_cv", "confidence", "reason"],
          properties: {
            is_valid_cv: { type: "boolean" },
            confidence: { type: "number", minimum: 0, maximum: 100 },
            reason: { type: "string", maxLength: 300 },
          },
        },
      },
    },
  };
}

async function providerDiagnostic(response: Response) {
  try {
    const body = (await response.json()) as {
      error?: { code?: unknown; param?: unknown };
    };
    return {
      providerCode:
        typeof body.error?.code === "string" ? body.error.code : undefined,
      providerParam:
        typeof body.error?.param === "string" ? body.error.param : undefined,
    };
  } catch {
    return {};
  }
}

async function approvedClassificationTransport(input: CvClassificationInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new CvClassificationProviderError("CV_CLASSIFICATION_NOT_CONFIGURED");
  if (
    !scoringProviderConfig.externalEnabled ||
    (!scoringProviderConfig.privacyApproved &&
      !scoringProviderConfig.localDevelopmentEnabled)
  ) {
    throw new CvClassificationProviderError("CV_CLASSIFICATION_NOT_CONFIGURED");
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    scoringProviderConfig.classificationTimeoutMilliseconds,
  );
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildCvClassificationRequestBody(input)),
      signal: controller.signal,
    });
    if (!response.ok) {
      const failureCode =
        response.status === 408 || response.status === 504
          ? "CV_CLASSIFICATION_TIMEOUT"
          : "CV_CLASSIFICATION_UNAVAILABLE";
      const diagnostic = await providerDiagnostic(response);
      logCvClassificationProviderFailure({
        reason: failureCode,
        model: scoringProviderConfig.classificationModelVersion,
        status: response.status,
        ...diagnostic,
      });
      throw new CvClassificationProviderError(
        failureCode,
        response.status === 408 ||
          response.status === 409 ||
          response.status === 425 ||
          response.status === 429 ||
          response.status >= 500,
      );
    }
    return parseClassification(await response.json());
  } catch (error) {
    if (error instanceof CvClassificationProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      logCvClassificationProviderFailure({
        reason: "CV_CLASSIFICATION_TIMEOUT",
        model: scoringProviderConfig.classificationModelVersion,
      });
      throw new CvClassificationProviderError(
        "CV_CLASSIFICATION_TIMEOUT",
        true,
      );
    }
    logCvClassificationProviderFailure({
      reason: "CV_CLASSIFICATION_UNAVAILABLE",
      model: scoringProviderConfig.classificationModelVersion,
    });
    throw new CvClassificationProviderError(
      "CV_CLASSIFICATION_UNAVAILABLE",
      true,
    );
  } finally {
    clearTimeout(timer);
  }
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new CvClassificationProviderError("CV_CLASSIFICATION_TIMEOUT", true),
      );
    }, milliseconds);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export class ApprovedCvClassificationAdapter {
  constructor(
    private readonly transport: CvClassificationTransport = approvedClassificationTransport,
  ) {}

  async classify(
    input: CvClassificationInput,
  ): Promise<CvClassificationResult> {
    try {
      const response = await withTimeout(
        this.transport({ cvText: input.cvText.slice(0, 12_000) }),
        scoringProviderConfig.classificationTimeoutMilliseconds,
      );
      return normalizeClassificationResponse(response);
    } catch (error) {
      const failure =
        error instanceof CvClassificationProviderError
          ? error
          : new CvClassificationProviderError(
              "CV_CLASSIFICATION_UNAVAILABLE",
              true,
            );
      return deterministicCvClassification(input, failure.code);
    }
  }
}

export type CvClassificationPort = Readonly<{
  classify(input: CvClassificationInput): Promise<CvClassificationResult>;
}>;
