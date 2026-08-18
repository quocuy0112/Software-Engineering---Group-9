import {
  aiAssessmentSchema,
  type AiAssessment,
} from "@/shared/contracts/scoring";
import {
  buildCvAiAssessmentPrompt,
  CV_AI_RUBRIC,
  CV_AI_SCORE_CATEGORIES,
  cvAiAssessmentJsonSchema,
  cvAiAssessmentV4Schema,
  cvAiAssessmentV5Schema,
  SUGGESTED_QUESTIONS_UNAVAILABLE_MESSAGE,
  type CvAiAssessmentV4,
  type CvAiAssessmentV5,
  type CvAiScoreCategory,
} from "../domain/cv-ai-assessment";
import {
  AiAssessmentProviderError,
  type AiProviderFailureCode,
  type AiAssessmentProviderInput,
  type AiAssessmentProviderPort,
} from "./ai-assessment-provider-port";
import { scoringProviderConfig } from "./config";

type Transport = (input: AiAssessmentProviderInput) => Promise<unknown>;

type OpenAiResponseBody = Readonly<{
  output_text?: unknown;
  status?: unknown;
  incomplete_details?: { reason?: unknown } | null;
  output?: ReadonlyArray<{
    type?: unknown;
    content?: ReadonlyArray<{
      type?: unknown;
      text?: unknown;
      refusal?: unknown;
    }>;
  }>;
}>;

function schemaIssueDiagnostic(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; code: string }>,
) {
  return issues
    .slice(0, 4)
    .map((issue) => `${issue.path.map(String).join(".") || "$"}:${issue.code}`)
    .join(",")
    .slice(0, 240);
}

function responseText(body: OpenAiResponseBody): string {
  const direct = typeof body.output_text === "string" ? body.output_text : "";
  if (direct.trim()) return direct.trim();
  return (
    body.output
      ?.flatMap((item) => item.content ?? [])
      .filter(
        (item) =>
          item.type === undefined || item.type === "output_text",
      )
      .map((item) => (typeof item.text === "string" ? item.text : ""))
      .join("")
      .trim() ?? ""
  );
}

function decodeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu)?.[1];
    if (!fenced) throw new AiAssessmentProviderError("AI_PROVIDER_MALFORMED", true, "RESPONSE_JSON_INVALID");
    try {
      return JSON.parse(fenced);
    } catch {
      throw new AiAssessmentProviderError("AI_PROVIDER_MALFORMED", true, "RESPONSE_JSON_INVALID");
    }
  }
}

type QualitySeed = Readonly<{
  bucket: "input_limitation" | "extraction_uncertainty";
  title: string;
  evidence: string;
  severity?: "MINOR" | "HIGH";
  affectedCategories?: readonly CvAiScoreCategory[];
}>;

type QualityNote = AiAssessment["dataQualityNotes"][number];

type BreakdownRow = {
  category: CvAiScoreCategory;
  value: number;
  maximum: number;
  note: string | null;
};

type Breakdown = Record<CvAiScoreCategory, BreakdownRow>;

const categoryMaximums: Record<CvAiScoreCategory, number> = {
  "Required skills": CV_AI_RUBRIC.required_skills_match,
  Experience: CV_AI_RUBRIC.experience_match,
  "Preferred skills": CV_AI_RUBRIC.preferred_skills_match,
  "Education/certifications": CV_AI_RUBRIC.education_certifications,
  Languages: CV_AI_RUBRIC.languages,
};

const categoryKeys: Record<CvAiScoreCategory, keyof typeof CV_AI_RUBRIC> = {
  "Required skills": "required_skills_match",
  Experience: "experience_match",
  "Preferred skills": "preferred_skills_match",
  "Education/certifications": "education_certifications",
  Languages: "languages",
};

function providerFailureCode(
  status: number,
  providerCode: unknown,
): AiProviderFailureCode {
  if (status === 408) return "AI_PROVIDER_TIMEOUT";
  if (status === 429) return "AI_PROVIDER_RATE_LIMITED";
  if (status === 401 || status === 403) return "AI_PROVIDER_AUTHENTICATION";
  if (status === 404 || providerCode === "model_not_found")
    return "AI_PROVIDER_MODEL_NOT_FOUND";
  if (status >= 400 && status < 500) return "AI_PROVIDER_INVALID_REQUEST";
  return "AI_PROVIDER_UNAVAILABLE";
}

async function approvedOpenAiTransport(input: AiAssessmentProviderInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new AiAssessmentProviderError("AI_PROVIDER_NOT_CONFIGURED");
  if (
    !scoringProviderConfig.externalEnabled ||
    (!scoringProviderConfig.privacyApproved &&
      !scoringProviderConfig.localDevelopmentEnabled)
  ) {
    throw new AiAssessmentProviderError("AI_PROVIDER_POLICY_NOT_APPROVED");
  }
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: scoringProviderConfig.modelVersion,
        background: false,
        store: false,
        stream: false,
        reasoning: { effort: "none" },
        truncation: "disabled",
        max_output_tokens: 12_000,
        instructions: buildCvAiAssessmentPrompt(input),
        input: "Return the structured JSON assessment now.",
        text: {
          format: {
            type: "json_schema",
            name: "ai_cv_assessment_v5",
            strict: true,
            schema: cvAiAssessmentJsonSchema,
          },
        },
      }),
      signal: AbortSignal.timeout(scoringProviderConfig.timeoutMilliseconds),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      ["AbortError", "TimeoutError"].includes(error.name)
    ) {
      throw new AiAssessmentProviderError("AI_PROVIDER_TIMEOUT", true);
    }
    throw new AiAssessmentProviderError("AI_PROVIDER_UNAVAILABLE", true);
  }
  if (!response.ok) {
    let providerCode: unknown;
    try {
      const errorBody = (await response.json()) as {
        error?: { code?: unknown };
      };
      providerCode = errorBody.error?.code;
    } catch {
      providerCode = undefined;
    }
    const code = providerFailureCode(response.status, providerCode);
    throw new AiAssessmentProviderError(
      code,
      response.status === 408 ||
        response.status === 429 ||
        response.status >= 500,
    );
  }
  let body: OpenAiResponseBody;
  try {
    body = (await response.json()) as OpenAiResponseBody;
  } catch {
    throw new AiAssessmentProviderError(
      "AI_PROVIDER_MALFORMED",
      true,
      "RESPONSE_BODY_INVALID",
    );
  }
  if (body.status === "incomplete")
    throw new AiAssessmentProviderError(
      "AI_PROVIDER_MALFORMED",
      true,
      `RESPONSE_INCOMPLETE_${String(body.incomplete_details?.reason ?? "UNKNOWN")}`,
    );
  const text = responseText(body);
  if (!text) {
    const refusal = body.output?.some((item) =>
      item.content?.some((content) => content.type === "refusal"),
    );
    throw new AiAssessmentProviderError(
      "AI_PROVIDER_MALFORMED",
      refusal ? false : true,
      refusal ? "RESPONSE_REFUSAL" : "RESPONSE_EMPTY_OUTPUT",
    );
  }
  return decodeJson(text);
}

function clip(value: string, maximum = 2_000) {
  return value.length > maximum ? value.slice(0, maximum) : value;
}

function dedupKey(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function evidenceForSkill(
  skill: string,
  input: AiAssessmentProviderInput,
): string {
  const normalizedSkill = dedupKey(skill);
  const evidence = input.evidence.find((item) => {
    const normalizedTitle = dedupKey(item.title);
    return (
      normalizedTitle === normalizedSkill ||
      normalizedTitle.includes(normalizedSkill) ||
      normalizedSkill.includes(normalizedTitle)
    );
  });
  return clip(evidence?.excerpt ?? skill);
}

function qualityCategory(value: string): string {
  const normalized = value.toLocaleLowerCase("en-US");
  if (
    /\bdates?\b|employment|start[-_ ]?date|end[-_ ]?date|experience duration|chronolog|redact/iu.test(
      normalized,
    )
  )
    return "employment_dates";
  if (
    /duplicate|repeated records|appears more than once|contradict/iu.test(
      normalized,
    )
  )
    return "duplicate_records";
  if (/bullet|responsibilit|no .*provided/iu.test(normalized))
    return "missing_responsibilities";
  if (/certif/iu.test(normalized)) return "missing_certifications";
  if (/language|english|vietnamese/iu.test(normalized))
    return "missing_languages";
  if (/cover letter/iu.test(normalized)) return "missing_cover_letter";
  if (
    /anomal|unrelated|merge|cross.?candidate|contamin|stale|garbl|corrupt|unparse/iu.test(
      normalized,
    )
  )
    return "anomalous_profile_data";
  return dedupKey(value);
}

function qualityTitle(
  category: string,
  bucket: "input_limitation" | "extraction_uncertainty",
): string {
  return (
    {
      employment_dates: "Employment dates",
      duplicate_records: "Duplicate profile records",
      missing_responsibilities: "Missing responsibilities",
      missing_certifications: "Missing certifications",
      missing_languages: "Missing language information",
      missing_cover_letter: "Missing cover letter",
      anomalous_profile_data: "Profile data quality",
    }[category] ??
    (bucket === "input_limitation"
      ? "Input limitation"
      : "Extraction uncertainty")
  );
}

function isQualityLike(value: string): boolean {
  return /\b(?:redact\w*|placeholder\w*|garbl\w*|unpars\w*|pars\w*|extract\w*|date\w*|duplicate\w*|contradict\w*|merge\w*|contamin\w*|corrupt\w*)\b|cross.?candidate|missing (?:field|section|responsibilit|employer)|no .*provided/iu.test(
    value,
  );
}

function isIgnorableOptionalInput(
  value: string,
  input: AiAssessmentProviderInput,
): boolean {
  return (
    /cover letter.*(?:not|no|missing)|no cover letter/iu.test(value) &&
    !(input.keyRequirements ?? []).some((item) => /cover letter/iu.test(item))
  );
}

function inferQualitySeverity(value: string): "MINOR" | "HIGH" {
  return /redact|placeholder|garbl|unparse|corrupt|duplicate|contradict|cross.?candidate|contamin|merged from|no extractable text|core section|cannot be (?:reliably )?(?:verified|parsed)|outside (?:the )?plausible|ambiguous .*?\bdates?\b|\bdates?\b.*ambiguous/iu.test(
    value,
  )
    ? "HIGH"
    : "MINOR";
}

function inferAffectedCategories(value: string): CvAiScoreCategory[] {
  const normalized = value.toLocaleLowerCase("en-US");
  const categories: CvAiScoreCategory[] = [];
  if (
    /\bdates?\b|employment|start[-_ ]?date|end[-_ ]?date|experience duration|chronolog/iu.test(
      normalized,
    )
  )
    categories.push("Experience");
  if (/required skill|skill|tool|technical/iu.test(normalized))
    categories.push("Required skills");
  if (/preferred/iu.test(normalized)) categories.push("Preferred skills");
  if (/education|degree|school|certif/iu.test(normalized))
    categories.push("Education/certifications");
  if (/language|english|vietnamese/iu.test(normalized))
    categories.push("Languages");
  return categories;
}

function collectQualityNotes(
  input: AiAssessmentProviderInput,
  seeds: readonly QualitySeed[],
): QualityNote[] {
  const notes: QualityNote[] = [];
  const seen = new Map<string, number>();
  const add = (seed: QualitySeed) => {
    const source = `${seed.title} ${seed.evidence}`;
    if (isIgnorableOptionalInput(source, input)) return;
    const category = qualityCategory(source);
    const key = category || dedupKey(source);
    const existingIndex = seen.get(key);
    const inferredCategories = seed.affectedCategories?.length
      ? [...seed.affectedCategories]
      : inferAffectedCategories(source);
    const severity = seed.severity ?? inferQualitySeverity(source);
    if (existingIndex !== undefined) {
      const existing = notes[existingIndex];
      if (existing && existing.severity !== "HIGH" && severity === "HIGH")
        existing.severity = "HIGH";
      if (existing && inferredCategories.length) {
        existing.affectedCategories = [
          ...new Set([...existing.affectedCategories, ...inferredCategories]),
        ];
      }
      return;
    }
    seen.set(key, notes.length);
    notes.push({
      id: `quality-${notes.length + 1}`,
      bucket: seed.bucket,
      severity,
      title: qualityTitle(category, seed.bucket),
      evidence: clip(
        `${seed.title}${seed.evidence ? ` — ${seed.evidence}` : ""}`,
      ),
      affectedCategories: inferredCategories,
    });
  };
  for (const issue of input.preflightIssues ?? [])
    add({
      bucket: issue.bucket,
      title: issue.description,
      evidence: issue.evidenceQuote ?? "",
    });
  for (const seed of seeds) add(seed);
  return notes.slice(0, 30);
}

function parsePoints(value: string): number {
  const [earned] = value.split("/");
  const parsed = Number(earned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function emptyBreakdown(): Breakdown {
  return Object.fromEntries(
    CV_AI_SCORE_CATEGORIES.map((category) => [
      category,
      {
        category,
        value: 0,
        maximum: categoryMaximums[category],
        note: null,
      },
    ]),
  ) as Breakdown;
}

function breakdownFromV5(result: CvAiAssessmentV5): Breakdown {
  const breakdown = emptyBreakdown();
  for (const item of result.scoreReasoning.breakdown) {
    breakdown[item.category].value = Math.min(
      breakdown[item.category].maximum,
      Math.max(0, parsePoints(item.points)),
    );
  }
  return breakdown;
}

function breakdownFromV4(result: CvAiAssessmentV4): Breakdown {
  const breakdown = emptyBreakdown();
  for (const category of CV_AI_SCORE_CATEGORIES) {
    const key = categoryKeys[category];
    breakdown[category].value = result.score_breakdown[key];
  }
  return breakdown;
}

function qualityReason(
  note: QualityNote,
  action: "capped" | "reduced",
): string {
  const detail = clip(note.evidence.replace(/^[^—]+—\s*/u, ""), 180).trim();
  return `${action} — ${detail || note.title.toLocaleLowerCase("en-US")}`;
}

function applyQualityToBreakdown(
  breakdown: Breakdown,
  notes: readonly QualityNote[],
): { score: number; breakdown: Breakdown } {
  const hasHigh = notes.some((note) => note.severity === "HIGH");
  const hasMinor = notes.length > 0;
  for (const note of notes) {
    for (const category of note.affectedCategories) {
      const row = breakdown[category];
      const cap =
        note.severity === "HIGH"
          ? category === "Experience"
            ? 15
            : Math.floor(row.maximum * 0.75)
          : Math.floor(row.maximum * 0.8);
      if (row.value > cap) {
        row.value = cap;
        row.note = qualityReason(
          note,
          note.severity === "HIGH" ? "capped" : "reduced",
        );
      }
    }
  }

  const target = hasHigh ? 70 : hasMinor ? 95 : null;
  if (target !== null) {
    let current = Object.values(breakdown).reduce(
      (sum, row) => sum + row.value,
      0,
    );
    const affected = new Set(notes.flatMap((note) => note.affectedCategories));
    const order = [
      "Required skills",
      "Preferred skills",
      "Education/certifications",
      "Languages",
      "Experience",
      ...notes.flatMap((note) => note.affectedCategories),
    ]
      .filter(
        (category, index, values): category is CvAiScoreCategory =>
          values.indexOf(category) === index,
      )
      .sort(
        (left, right) =>
          Number(affected.has(left)) - Number(affected.has(right)),
      );
    for (const category of order) {
      if (current <= target) break;
      const row = breakdown[category];
      const reduction = Math.min(row.value, current - target);
      if (reduction <= 0) continue;
      row.value = roundScore(row.value - reduction);
      const affectedNote = notes.find((note) =>
        note.affectedCategories.includes(category),
      );
      row.note ??= affectedNote
        ? qualityReason(affectedNote, hasHigh ? "capped" : "reduced")
        : `${hasHigh ? "capped" : "reduced"} — overall score reflects ${hasHigh ? "HIGH" : "minor"} CV data-quality uncertainty`;
      current = Object.values(breakdown).reduce(
        (sum, item) => sum + item.value,
        0,
      );
    }
  }
  return {
    score: roundScore(
      Object.values(breakdown).reduce((sum, row) => sum + row.value, 0),
    ),
    breakdown,
  };
}

function matchLabel(
  score: number,
): "high match" | "medium match" | "low match" {
  return score >= 75
    ? "high match"
    : score >= 45
      ? "medium match"
      : "low match";
}

function confidenceLevel(
  percent: number,
  notes: readonly QualityNote[],
): "LOW" | "MEDIUM" | "HIGH" {
  if (notes.some((note) => note.severity === "HIGH")) return "LOW";
  if (notes.length > 0) return "MEDIUM";
  return percent >= 76 ? "HIGH" : percent >= 60 ? "MEDIUM" : "LOW";
}

function normalizedConfidence(
  rawPercent: number,
  notes: readonly QualityNote[],
) {
  const max = notes.some((note) => note.severity === "HIGH")
    ? 50
    : notes.length > 0
      ? 75
      : 95;
  const percent = Math.min(Math.max(0, Math.round(rawPercent)), max);
  const level = confidenceLevel(percent, notes);
  const cappedReason = notes.length
    ? `${level === "LOW" ? "Capped at Low confidence (50% maximum)" : "Capped at Medium confidence (75% maximum)"} because ${notes[0]?.title.toLocaleLowerCase("en-US") ?? "CV data quality is limited"}.`
    : null;
  return { percent, level, cappedReason };
}

function criterionTitle(value: keyof typeof CV_AI_RUBRIC): string {
  return {
    required_skills_match: "Required-skill evidence to verify",
    experience_match: "Experience depth to verify",
    preferred_skills_match: "Preferred-skill evidence to verify",
    education_certifications: "Education/certification evidence to verify",
    languages: "Language evidence to verify",
  }[value];
}

function normalizeTitle(
  title: string,
  fallback: string,
  skillTitles: readonly string[] = [],
): string {
  const normalized = dedupKey(title);
  if (
    !normalized ||
    [
      "skill found",
      "skill found verbatim",
      "relevant skill",
      "strength",
    ].includes(normalized) ||
    skillTitles.some((skill) => dedupKey(skill) === normalized)
  )
    return fallback;
  return clip(title.trim(), 160);
}

function synthesizeStrengths(
  raw: ReadonlyArray<{ title: string; evidence: string }>,
  extraction:
    | CvAiAssessmentV4["extraction"]
    | CvAiAssessmentV5["extraction"]
    | undefined,
  input: AiAssessmentProviderInput,
): Array<{ title: string; evidence: string }> {
  const strengths: Array<{ title: string; evidence: string }> = [];
  const skillTitles = [
    ...(input.requiredSkills ?? []),
    ...(input.preferredSkills ?? []),
  ];
  const add = (title: string, evidence: string) => {
    const cleanEvidence = clip(evidence).trim();
    if (
      !cleanEvidence ||
      strengths.some(
        (item) => dedupKey(item.evidence) === dedupKey(cleanEvidence),
      )
    )
      return;
    strengths.push({
      title: normalizeTitle(title, "Relevant delivery evidence", skillTitles),
      evidence: cleanEvidence,
    });
  };
  raw.forEach((item) => add(item.title, item.evidence));
  const experience = extraction?.experience_entries.find(
    (entry) => entry.bullet_points.length > 0,
  );
  if (strengths.length < 3 && experience) {
    add(
      "Relevant delivery depth",
      `As ${experience.title || "a contributor"} at ${experience.company || "the listed employer"}, the CV states: "${experience.bullet_points[0]}"`,
    );
  }
  const evidence = input.evidence.filter(
    (item) => item.title !== "Candidate profile",
  );
  if (strengths.length < 3 && evidence[0])
    add(
      "Role-relevant evidence",
      `The CV ties ${evidence[0].title} to this work: "${evidence[0].excerpt}"`,
    );
  if (strengths.length < 3 && evidence[1])
    add(
      "Combined-skill evidence",
      `The same CV evidence connects ${evidence[0]?.title ?? "the role skill"} and ${evidence[1].title}: "${evidence[1].excerpt}"`,
    );
  return strengths.slice(0, 4);
}

function synthesizePoints(
  raw: ReadonlyArray<{ title: string; reason: string }>,
  deductions: ReadonlyArray<{
    criterion: keyof typeof CV_AI_RUBRIC;
    points_deducted: number;
    evidence_quote: string;
  }>,
  reviewReasons: readonly string[],
): Array<{ title: string; reason: string }> {
  const points: Array<{ title: string; reason: string }> = [];
  const seen = new Set<string>();
  const add = (title: string, reason: string) => {
    const key = `${dedupKey(title)}|${dedupKey(reason)}`;
    if (!title.trim() || !reason.trim() || seen.has(key)) return;
    seen.add(key);
    points.push({
      title: clip(title.trim(), 160),
      reason: clip(reason.trim()),
    });
  };
  raw
    .filter((item) => !isQualityLike(`${item.title} ${item.reason}`))
    .forEach((item) => add(item.title, item.reason));
  deductions
    .filter((item) => item.points_deducted > 0)
    .forEach((item) =>
      add(
        criterionTitle(item.criterion),
        `The CV evidence "${item.evidence_quote}" does not fully establish the required depth or scope; ask the candidate to clarify the missing context.`,
      ),
    );
  reviewReasons.forEach((reason) => add("Evidence to verify", reason));
  return points.slice(0, 4);
}

function fallbackQuestions(
  points: Array<{ title: string; reason: string }>,
  strengths: readonly { title: string; evidence: string }[],
  input: AiAssessmentProviderInput,
): string[] {
  const point = points[0];
  const achievement =
    strengths[0]?.evidence ??
    input.evidence[0]?.excerpt ??
    "the achievement described in your CV";
  const role = input.jobTitle || "this role";
  const required =
    input.requiredSkills?.[0] || "the required skills for this role";
  return [
    `Your application has one ${point?.title.toLocaleLowerCase("en-US") ?? "scope point to verify"}: ${point?.reason ?? "please clarify the responsibilities you personally owned"}. What was your direct contribution?`,
    `Your CV states: "${clip(achievement, 220)}". What metric or concrete outcome did you achieve, and how did you verify it?`,
    `For the ${role} role, how would you apply ${required} in your first project, based on the experience described in your CV?`,
  ];
}

type BuildAssessmentInput = Readonly<{
  assessmentId: string;
  breakdown: Breakdown;
  rawConfidencePercent: number;
  rawRequiresHumanReview: boolean;
  qualityNotes: readonly QualityNote[];
  rawStrengths: ReadonlyArray<{ title: string; evidence: string }>;
  rawPoints: ReadonlyArray<{ title: string; reason: string }>;
  deductions?: ReadonlyArray<{
    criterion: keyof typeof CV_AI_RUBRIC;
    points_deducted: number;
    evidence_quote: string;
  }>;
  reviewReasons?: readonly string[];
  rawQuestions: readonly string[];
  rawQuestionsUnavailableReason: string | null;
  rawOverallAssessment: string;
  provider: string;
  modelVersion: string;
  promptVersion: string;
  policyVersion: string;
  extraction?: CvAiAssessmentV4["extraction"] | CvAiAssessmentV5["extraction"];
  input: AiAssessmentProviderInput;
  existingAssessmentLimited?: boolean;
}>;

function buildPublishedAssessment(input: BuildAssessmentInput): AiAssessment {
  const normalized = applyQualityToBreakdown(
    input.breakdown,
    input.qualityNotes,
  );
  const confidence = normalizedConfidence(
    input.rawConfidencePercent,
    input.qualityNotes,
  );
  const strengths = synthesizeStrengths(
    input.rawStrengths,
    input.extraction,
    input.input,
  );
  const points = synthesizePoints(
    input.rawPoints,
    input.deductions ?? [],
    input.reviewReasons ?? [],
  );
  const assessmentLimitedByDataQuality =
    Boolean(input.existingAssessmentLimited || input.qualityNotes.length > 0) &&
    strengths.length === 0 &&
    points.length === 0;
  if (
    !assessmentLimitedByDataQuality &&
    points.length === 0 &&
    (input.rawQuestions.length > 0 || strengths.length > 0)
  ) {
    points.push({
      title: "Scope and impact to verify",
      reason:
        "The CV contains relevant evidence, but the exact ownership scope or measurable outcome still needs a candidate-specific confirmation.",
    });
  }
  const questions = assessmentLimitedByDataQuality
    ? []
    : input.rawQuestions.length === 3
      ? [...input.rawQuestions]
      : points.length > 0 || strengths.length > 0
        ? fallbackQuestions(points, strengths, input.input)
        : [];
  const questionsUnavailableReason =
    questions.length === 3
      ? null
      : assessmentLimitedByDataQuality
        ? SUGGESTED_QUESTIONS_UNAVAILABLE_MESSAGE
        : (input.rawQuestionsUnavailableReason ??
          "There is not enough job-relevant evidence to generate candidate-specific questions.");
  const pointFindings = points.map((item, index) => ({
    id: `point-to-verify-${index + 1}`,
    kind: "POINT_TO_VERIFY" as const,
    title: item.title,
    evidence: item.reason,
  }));
  const strengthFindings = strengths.map((item, index) => ({
    id: `strength-${index + 1}`,
    kind: "STRENGTH" as const,
    title: item.title,
    evidence: item.evidence,
  }));
  const findings = [...strengthFindings, ...pointFindings];
  const generatedQuestions =
    questions.length === 3
      ? questions.map((question, index) => ({
          question,
          pointToVerifyId:
            pointFindings[index % Math.max(1, pointFindings.length)]?.id ??
            "point-to-verify-1",
        }))
      : [];
  const breakdown = CV_AI_SCORE_CATEGORIES.map((category) => {
    const row = normalized.breakdown[category];
    return `${category}: ${row.value}/${row.maximum}${row.note ? ` (${row.note})` : ""}`;
  });
  const reasoning = {
    score: normalized.score,
    breakdown: CV_AI_SCORE_CATEGORIES.map((category) => {
      const row = normalized.breakdown[category];
      return {
        category,
        points: `${row.value}/${row.maximum}`,
        note: row.note,
      };
    }),
    aiTotal: normalized.score,
    matchLabel: matchLabel(normalized.score),
    confidence: {
      percent: confidence.percent,
      level:
        confidence.level === "LOW"
          ? "Low"
          : confidence.level === "MEDIUM"
            ? "Medium"
            : "High",
      cappedReason: confidence.cappedReason,
    },
  } as const;
  const humanReview =
    input.rawRequiresHumanReview ||
    input.qualityNotes.length > 0 ||
    confidence.level !== "HIGH";
  return {
    assessmentId: input.assessmentId,
    score: normalized.score,
    confidencePercent: confidence.percent,
    confidenceLevel: confidence.level,
    confidenceLabel:
      confidence.level === "LOW"
        ? "Low confidence"
        : confidence.level === "MEDIUM"
          ? "Medium confidence"
          : "High confidence",
    humanReviewGuidance: humanReview
      ? input.qualityNotes.length
        ? `Confidence is capped because ${input.qualityNotes[0]?.title.toLocaleLowerCase("en-US") ?? "the CV has data-quality limitations"}. Review the evidence before making a decision.`
        : "Review the fit evidence and verification points before making a decision."
      : null,
    requiresHumanReview: humanReview,
    provider: input.provider,
    modelVersion: input.modelVersion,
    promptVersion: input.promptVersion,
    policyVersion: input.policyVersion,
    overallSummary: assessmentLimitedByDataQuality
      ? "Assessment is limited by CV data quality. The CV could not be assessed reliably; manual review is required."
      : clip(input.rawOverallAssessment),
    breakdown: [
      breakdown.slice(0, 2).join("; "),
      breakdown.slice(2, 4).join("; "),
      `${breakdown[4]}; AI total: ${normalized.score}/100 (${reasoning.matchLabel}); confidence: ${confidence.percent}% (${reasoning.confidence.level})`,
    ],
    scoreReasoning: reasoning,
    strengths,
    pointsToVerify: points,
    suggestedQuestions: questions,
    questionsUnavailableReason,
    assessmentLimitedByDataQuality,
    dataQualityNotes: [...input.qualityNotes],
    findings,
    compliance: {
      code: "SENSITIVE_ATTRIBUTES_EXCLUDED",
      label: "Sensitive personal attributes are excluded from scoring.",
    },
    questions:
      questions.length === 3
        ? { kind: "GENERATED", items: generatedQuestions }
        : {
            kind: "INSUFFICIENT_DATA",
            fallbackMessage:
              questionsUnavailableReason ??
              "There is not enough job-relevant evidence to generate candidate-specific questions.",
          },
  };
}

function toAiAssessment(
  result: CvAiAssessmentV5,
  input: AiAssessmentProviderInput,
): AiAssessment {
  const qualityNotes = collectQualityNotes(
    input,
    result.dataQualityNotes.map((item) => ({
      bucket: item.bucket,
      title: item.title,
      evidence: item.evidence,
      severity: item.severity,
      affectedCategories: item.affectedCategories,
    })),
  );
  return buildPublishedAssessment({
    assessmentId: `ai-${input.applicationId}-${Date.now()}`,
    breakdown: breakdownFromV5(result),
    rawConfidencePercent: result.scoreReasoning.confidence.percent,
    rawRequiresHumanReview: result.scoreReasoning.confidence.level !== "High",
    qualityNotes,
    rawStrengths: result.strengths,
    rawPoints: result.pointsToVerify,
    rawQuestions: result.suggestedQuestions,
    rawQuestionsUnavailableReason: result.questionsUnavailableReason,
    rawOverallAssessment: result.overallAssessment,
    provider: "openai-resume-screening",
    modelVersion: scoringProviderConfig.modelVersion,
    promptVersion: scoringProviderConfig.promptVersion,
    policyVersion: scoringProviderConfig.policyVersion,
    extraction: result.extraction,
    input,
  });
}

function toLegacyAiAssessment(
  result: CvAiAssessmentV4,
  input: AiAssessmentProviderInput,
): AiAssessment {
  const seeds: QualitySeed[] = result.data_quality_issues.map((item) => ({
    bucket: item.bucket,
    title: qualityTitle(qualityCategory(item.description), item.bucket),
    evidence: `${item.description}${item.evidence_quote ? ` Evidence: "${item.evidence_quote}"` : ""}`,
  }));
  const fitReasons = result.review_reasons
    .filter((item) => !isQualityLike(item.reason))
    .map((item) => item.reason);
  const qualityReasons = result.review_reasons.filter((item) =>
    isQualityLike(item.reason),
  );
  qualityReasons.forEach((item) =>
    seeds.push({
      bucket: item.bucket,
      title: qualityTitle(qualityCategory(item.reason), item.bucket),
      evidence: item.reason,
    }),
  );
  result.extraction.extraction_flags.forEach((flag) => {
    if (isQualityLike(flag))
      seeds.push({
        bucket: "extraction_uncertainty",
        title: qualityTitle(qualityCategory(flag), "extraction_uncertainty"),
        evidence: flag,
      });
  });
  const qualityNotes = collectQualityNotes(input, seeds);
  const evidenceStrengths = result.extraction.skills_found_verbatim.map(
    (skill) => ({
      title: "Relevant skill evidence",
      evidence: evidenceForSkill(skill, input),
    }),
  );
  return buildPublishedAssessment({
    assessmentId: `ai-${input.applicationId}-${Date.now()}`,
    breakdown: breakdownFromV4(result),
    rawConfidencePercent: result.confidence_pct,
    rawRequiresHumanReview: result.requires_human_review,
    qualityNotes,
    rawStrengths: evidenceStrengths,
    rawPoints: [],
    deductions: result.deduction_reasons,
    reviewReasons: fitReasons,
    rawQuestions: [],
    rawQuestionsUnavailableReason: null,
    rawOverallAssessment: result.overall_assessment,
    provider: "openai-resume-screening",
    modelVersion: scoringProviderConfig.modelVersion,
    promptVersion: scoringProviderConfig.promptVersion,
    policyVersion: scoringProviderConfig.policyVersion,
    extraction: result.extraction,
    input,
  });
}

/** Normalize legacy published/provider-shaped responses through the same
 * quality policy so a direct adapter cannot reintroduce duplicate cards or a
 * high-confidence result next to a quality warning. */
function canonicalizeAiAssessment(
  result: AiAssessment,
  input: AiAssessmentProviderInput,
): AiAssessment {
  const legacyQualityFindings = result.findings.filter(
    (finding) =>
      [
        "Data quality review",
        "Extraction flag",
        "Input limitation",
        "Extraction uncertainty",
      ].includes(finding.title) ||
      /^data quality|^extraction flag/iu.test(finding.title),
  );
  const qualityNotes = collectQualityNotes(input, [
    ...result.dataQualityNotes.map((note) => ({
      bucket: note.bucket,
      title: note.title,
      evidence: note.evidence,
      severity: note.severity,
      affectedCategories: note.affectedCategories,
    })),
    ...legacyQualityFindings.map((finding) => ({
      bucket: /^input_limitation:/iu.test(finding.evidence)
        ? ("input_limitation" as const)
        : ("extraction_uncertainty" as const),
      title: finding.title,
      evidence: finding.evidence,
    })),
  ]);
  const breakdown = emptyBreakdown();
  for (const item of result.scoreReasoning.breakdown)
    breakdown[item.category].value = parsePoints(item.points);
  const visibleFindings = result.findings.filter(
    (finding) => !legacyQualityFindings.includes(finding),
  );
  const strengths = result.strengths.length
    ? result.strengths
    : visibleFindings
        .filter((item) => item.kind === "STRENGTH")
        .map((item) => ({ title: item.title, evidence: item.evidence }));
  const points = result.pointsToVerify.length
    ? result.pointsToVerify
    : visibleFindings
        .filter((item) => item.kind === "POINT_TO_VERIFY")
        .map((item) => ({ title: item.title, reason: item.evidence }));
  return buildPublishedAssessment({
    assessmentId: result.assessmentId,
    breakdown,
    rawConfidencePercent: result.confidencePercent,
    rawRequiresHumanReview: result.requiresHumanReview,
    qualityNotes,
    rawStrengths: strengths,
    rawPoints: points,
    rawQuestions: result.suggestedQuestions.length
      ? result.suggestedQuestions
      : result.questions.kind === "GENERATED"
        ? result.questions.items.map((item) => item.question)
        : [],
    rawQuestionsUnavailableReason: result.questionsUnavailableReason,
    rawOverallAssessment: result.overallSummary,
    provider: result.provider,
    modelVersion: result.modelVersion,
    promptVersion: result.promptVersion,
    policyVersion: result.policyVersion,
    input,
    existingAssessmentLimited: result.assessmentLimitedByDataQuality,
  });
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Circuit breaking is useful for provider transport outages, but a malformed
 * model response is scoped to one generation attempt. Counting every retry
 * inside one assessment (or every schema validation failure) made one bad CV
 * response open the shared worker circuit and block the recruiter's next
 * retry. Only final transport failures are allowed to trip the circuit.
 */
function countsTowardsCircuit(code: AiProviderFailureCode): boolean {
  return [
    "AI_PROVIDER_TIMEOUT",
    "AI_PROVIDER_UNAVAILABLE",
    "AI_PROVIDER_RATE_LIMITED",
    "AI_PROVIDER_RETRY_EXHAUSTED",
  ].includes(code);
}

export class ApprovedAiAssessmentAdapter implements AiAssessmentProviderPort {
  private consecutiveFailures = 0;
  private circuitOpenedAt: number | null = null;

  constructor(
    private readonly transport: Transport = approvedOpenAiTransport,
  ) {}

  async assess(input: AiAssessmentProviderInput): Promise<AiAssessment> {
    if (
      this.circuitOpenedAt !== null &&
      Date.now() - this.circuitOpenedAt <
        scoringProviderConfig.circuitResetMilliseconds
    ) {
      throw new AiAssessmentProviderError("AI_PROVIDER_CIRCUIT_OPEN", true);
    }
    if (
      this.circuitOpenedAt !== null &&
      Date.now() - this.circuitOpenedAt >=
        scoringProviderConfig.circuitResetMilliseconds
    ) {
      // Allow one half-open probe after the cooldown. A successful probe
      // clears this state below; a final transport failure starts a fresh
      // cooldown instead of inheriting the previous attempt count.
      this.circuitOpenedAt = null;
      this.consecutiveFailures = 0;
    }
    for (
      let attempt = 1;
      attempt <= scoringProviderConfig.maxAttempts;
      attempt++
    ) {
      try {
        const raw = await Promise.race([
          this.transport(redactProviderInput(input)),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new AiAssessmentProviderError("AI_PROVIDER_TIMEOUT", true),
                ),
              scoringProviderConfig.timeoutMilliseconds,
            ),
          ),
        ]);
        const v5 = cvAiAssessmentV5Schema.safeParse(raw);
        if (v5.success) {
          this.consecutiveFailures = 0;
          this.circuitOpenedAt = null;
          return toAiAssessment(v5.data, input);
        }
        const published = aiAssessmentSchema.safeParse(raw);
        if (published.success) {
          this.consecutiveFailures = 0;
          this.circuitOpenedAt = null;
          return canonicalizeAiAssessment(published.data, input);
        }
        const v4 = cvAiAssessmentV4Schema.safeParse(raw);
        if (!v4.success)
          throw new AiAssessmentProviderError(
            "AI_PROVIDER_MALFORMED",
            true,
            `RESPONSE_SCHEMA_INVALID:${schemaIssueDiagnostic(v5.error.issues)}`,
          );
        this.consecutiveFailures = 0;
        this.circuitOpenedAt = null;
        return toLegacyAiAssessment(v4.data, input);
      } catch (error) {
        const providerError =
          error instanceof AiAssessmentProviderError
            ? error
            : new AiAssessmentProviderError("AI_PROVIDER_UNAVAILABLE", true);
        const canRetry =
          providerError.transient &&
          attempt < scoringProviderConfig.maxAttempts;
        if (!canRetry) {
          // A malformed provider response is retryable because generation can
          // be truncated or otherwise malformed for one request. Preserve its
          // diagnostic after the bounded retries so the UI does not misreport
          // a validation failure as a generic transport outage.
          if (
            attempt > 1 &&
            providerError.transient &&
            providerError.code !== "AI_PROVIDER_MALFORMED"
          ) {
            const exhausted = new AiAssessmentProviderError(
              "AI_PROVIDER_RETRY_EXHAUSTED",
              true,
              providerError.diagnostic,
            );
            this.recordCircuitFailure(exhausted);
            throw exhausted;
          }
          this.recordCircuitFailure(providerError);
          throw providerError;
        }
        await sleep(Math.min(500 * 2 ** (attempt - 1), 2_000));
      }
    }
    throw new AiAssessmentProviderError("AI_PROVIDER_RETRY_EXHAUSTED", true);
  }

  private recordCircuitFailure(error: AiAssessmentProviderError) {
    if (!countsTowardsCircuit(error.code)) return;
    // One provider operation counts as one failure. Counting each bounded
    // retry inflated the threshold and caused the next candidate to receive
    // CIRCUIT_OPEN before the provider had a chance to recover.
    this.consecutiveFailures += 1;
    if (
      this.consecutiveFailures >=
      scoringProviderConfig.circuitFailureThreshold
    )
      this.circuitOpenedAt = Date.now();
  }
}

function redactProviderInput(
  input: AiAssessmentProviderInput,
): AiAssessmentProviderInput {
  const redact = (value: string | undefined) => {
    if (value === undefined) return undefined;
    const dates: string[] = [];
    const protectedValue = value.replace(/\b\d{4}-\d{2}-\d{2}\b/gu, (date) => {
      const token = `__SMART_HIRE_DATE_${dates.length}__`;
      dates.push(date);
      return token;
    });
    const redacted = protectedValue
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[email redacted]")
      .replace(/(?:\+?\d[\d ()-]{7,}\d)/gu, "[phone redacted]");
    return redacted.replace(
      /__SMART_HIRE_DATE_(\d+)__/gu,
      (_match, index: string) => dates[Number(index)] ?? _match,
    );
  };
  return {
    ...input,
    evidence: input.evidence.map((item) => ({
      ...item,
      excerpt: redact(item.excerpt) ?? item.excerpt,
    })),
    cvText: redact(input.cvText),
    coverLetterText: redact(input.coverLetterText),
  };
}
