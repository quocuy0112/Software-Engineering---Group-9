import { aiAssessmentSchema, type AiAssessment } from "@/shared/contracts/scoring";
import {
  buildCvAiAssessmentPrompt,
  cvAiAssessmentJsonSchema,
  cvAiAssessmentV4Schema,
  type CvAiAssessmentV4,
} from "../domain/cv-ai-assessment";
import {
  AiAssessmentProviderError,
  type AiProviderFailureCode,
  type AiAssessmentProviderInput,
  type AiAssessmentProviderPort,
} from "./ai-assessment-provider-port";
import { scoringProviderConfig } from "./config";
type Transport = (input: AiAssessmentProviderInput) => Promise<unknown>;

function providerFailureCode(status: number, providerCode: unknown): AiProviderFailureCode {
  if (status === 408) return "AI_PROVIDER_TIMEOUT";
  if (status === 429) return "AI_PROVIDER_RATE_LIMITED";
  if (status === 401 || status === 403) return "AI_PROVIDER_AUTHENTICATION";
  if (status === 404 || providerCode === "model_not_found") return "AI_PROVIDER_MODEL_NOT_FOUND";
  if (status >= 400 && status < 500) return "AI_PROVIDER_INVALID_REQUEST";
  return "AI_PROVIDER_UNAVAILABLE";
}

async function approvedOpenAiTransport(input: AiAssessmentProviderInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiAssessmentProviderError("AI_PROVIDER_NOT_CONFIGURED");
  if (!scoringProviderConfig.externalEnabled || (!scoringProviderConfig.privacyApproved && !scoringProviderConfig.localDevelopmentEnabled)) {
    throw new AiAssessmentProviderError("AI_PROVIDER_POLICY_NOT_APPROVED");
  }
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
            name: "ai_cv_assessment_v4",
            strict: true,
            schema: cvAiAssessmentJsonSchema,
          },
        },
      }),
      signal: AbortSignal.timeout(scoringProviderConfig.timeoutMilliseconds),
    });
  } catch (error) {
    if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) {
      throw new AiAssessmentProviderError("AI_PROVIDER_TIMEOUT", true);
    }
    throw new AiAssessmentProviderError("AI_PROVIDER_UNAVAILABLE", true);
  }
  if (!response.ok) {
    let providerCode: unknown;
    try {
      const errorBody = await response.json() as { error?: { code?: unknown } };
      providerCode = errorBody.error?.code;
    } catch {
      providerCode = undefined;
    }
    const code = providerFailureCode(response.status, providerCode);
    throw new AiAssessmentProviderError(
      code,
      response.status === 408 || response.status === 429 || response.status >= 500,
    );
  }
  const body = await response.json() as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  const text = body.output_text ?? body.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("");
  if (!text) throw new AiAssessmentProviderError("AI_PROVIDER_MALFORMED");
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new AiAssessmentProviderError("AI_PROVIDER_MALFORMED");
  }
  const candidate = cvAiAssessmentV4Schema.safeParse(decoded);
  if (!candidate.success) throw new AiAssessmentProviderError("AI_PROVIDER_MALFORMED");
  return toAiAssessment(candidate.data, input);
}

function clip(value: string, maximum = 2_000) {
  return value.length > maximum ? value.slice(0, maximum) : value;
}

function dedupKey(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function evidenceForSkill(skill: string, input: AiAssessmentProviderInput): string {
  const normalizedSkill = dedupKey(skill);
  const evidence = input.evidence.find((item) => {
    const normalizedTitle = dedupKey(item.title);
    return normalizedTitle === normalizedSkill || normalizedTitle.includes(normalizedSkill) || normalizedSkill.includes(normalizedTitle);
  });
  return clip(evidence?.excerpt ?? skill);
}

function criterionTitle(value: CvAiAssessmentV4["deduction_reasons"][number]["criterion"]): string {
  return {
    required_skills_match: "Required skills match",
    experience_match: "Experience match",
    preferred_skills_match: "Preferred skills match",
    education_certifications: "Education and certifications",
    languages: "Language proficiency",
  }[value];
}

function qualityCategory(value: string): string {
  const normalized = value.toLocaleLowerCase("en-US");
  if (/date|employment|startdate|enddate|experience duration|redact/iu.test(normalized)) return "employment_dates";
  if (/duplicate|repeated records|appears more than once/iu.test(normalized)) return "duplicate_records";
  if (/bullet|responsibilit|no .*provided/iu.test(normalized)) return "missing_responsibilities";
  if (/cover letter/iu.test(normalized)) return "missing_cover_letter";
  if (/anomal|unrelated|merge|cross.?candidate|stale/iu.test(normalized)) return "anomalous_profile_data";
  return dedupKey(value);
}

function qualityTitle(category: string, bucket: "input_limitation" | "extraction_uncertainty"): string {
  return {
    employment_dates: "Employment dates",
    duplicate_records: "Duplicate profile records",
    missing_responsibilities: "Missing responsibilities",
    missing_cover_letter: "Missing cover letter",
    anomalous_profile_data: "Profile data quality",
  }[category] ?? (bucket === "input_limitation" ? "Input limitation" : "Extraction uncertainty");
}

function toAiAssessment(result: CvAiAssessmentV4, input: AiAssessmentProviderInput): AiAssessment {
  const requiresHumanReview = result.requires_human_review || result.confidence_pct < 75;
  const skills = result.extraction.skills_found_verbatim.filter((skill, index, values) =>
    values.findIndex((candidate) => dedupKey(candidate) === dedupKey(skill)) === index,
  ).slice(0, 20);
  const points = result.deduction_reasons.filter((item, index, values) =>
    values.findIndex((candidate) => candidate.criterion === item.criterion) === index,
  ).map((item, index) => ({
      id: `deduction-${index + 1}`,
      kind: "POINT_TO_VERIFY" as const,
      title: criterionTitle(item.criterion),
      evidence: clip(item.evidence_quote),
    }));
  const qualityNotes: Array<AiAssessment["dataQualityNotes"][number]> = [];
  const seenQuality = new Set<string>();
  const addQuality = (bucket: "input_limitation" | "extraction_uncertainty", description: string, quote: string | null) => {
    const category = qualityCategory(`${description} ${quote ?? ""}`);
    if (seenQuality.has(category)) return;
    seenQuality.add(category);
    qualityNotes.push({
      id: `quality-${qualityNotes.length + 1}`,
      bucket,
      title: qualityTitle(category, bucket),
      evidence: clip(`${description}${quote ? ` Evidence: "${quote}"` : ""}`),
    });
  };
  for (const issue of input.preflightIssues ?? []) addQuality(issue.bucket, issue.description, issue.evidenceQuote);
  for (const item of result.data_quality_issues) addQuality(item.bucket, item.description, item.evidence_quote);
  for (const item of result.review_reasons) addQuality(item.bucket, item.reason, null);
  for (const flag of result.extraction.extraction_flags) {
    const category = qualityCategory(flag);
    if (seenQuality.has(category)) continue;
    addQuality("extraction_uncertainty", flag, null);
  }
  const severeQuality = qualityNotes.some((item) => [
    "Employment dates",
    "Duplicate profile records",
    "Missing responsibilities",
    "Profile data quality",
  ].includes(item.title));
  const assessmentLimitedByDataQuality = qualityNotes.length > 0 && (severeQuality || result.confidence_pct < 75);
  const findings: Array<AiAssessment["findings"][number]> = [
    ...skills.map((skill, index) => ({
      id: `skill-${index + 1}`,
      kind: "STRENGTH" as const,
      title: "Skill found",
      evidence: evidenceForSkill(skill, input),
    })),
    ...(assessmentLimitedByDataQuality ? points.slice(0, 2) : points),
  ];
  const breakdown = result.score_breakdown;
  const breakdownLines = [
    `Required skills: ${breakdown.required_skills_match}/40; experience: ${breakdown.experience_match}/25`,
    `Preferred skills: ${breakdown.preferred_skills_match}/15; education/certifications: ${breakdown.education_certifications}/10; languages: ${breakdown.languages}/10`,
    `AI total: ${result.total_score}/100 (${result.match_level} match); confidence: ${result.confidence_pct}%`,
  ];
  return {
    assessmentId: `ai-${input.applicationId}-${Date.now()}`,
    score: result.total_score,
    confidencePercent: result.confidence_pct,
    confidenceLevel: result.confidence_pct < 75 ? "LOW" : "STANDARD",
    confidenceLabel: requiresHumanReview ? "Human review required" : "Standard confidence",
    humanReviewGuidance: requiresHumanReview
      ? assessmentLimitedByDataQuality
        ? "Assessment is limited by CV data quality. Review the notes in the CV & Cover letter tab before using the score."
        : "Review the fit evidence and deduction reasons before making a decision."
      : null,
    requiresHumanReview,
    provider: "openai-resume-screening",
    modelVersion: scoringProviderConfig.modelVersion,
    promptVersion: scoringProviderConfig.promptVersion,
    policyVersion: scoringProviderConfig.policyVersion,
    overallSummary: assessmentLimitedByDataQuality
      ? "Low data quality — assessment limited. The CV could not be assessed reliably; manual review is required."
      : clip(result.overall_assessment),
    breakdown: breakdownLines,
    findings: findings.slice(0, 50),
    assessmentLimitedByDataQuality,
    dataQualityNotes: qualityNotes.slice(0, 30),
    compliance: { code: "SENSITIVE_ATTRIBUTES_EXCLUDED", label: "Sensitive personal attributes are excluded from scoring." },
    questions: { kind: "INSUFFICIENT_DATA", fallbackMessage: assessmentLimitedByDataQuality ? "Suggested questions are unavailable because CV data quality is too low for a reliable assessment." : requiresHumanReview ? "Review the fit evidence and deduction reasons before making a decision." : "There is not enough job-relevant evidence to generate suggested questions." },
  };
}

/** Normalize provider responses that already look like the published UI
 * contract.  Older local adapters returned this shape directly and used
 * `Skill found verbatim` plus data-quality findings in the fit list; accepting
 * that response unchanged would reintroduce the duplicate cards we are
 * explicitly preventing. */
function canonicalizeAiAssessment(result: AiAssessment, input: AiAssessmentProviderInput): AiAssessment {
  const skills: AiAssessment["findings"] = [];
  const points: AiAssessment["findings"] = [];
  const qualityNotes: AiAssessment["dataQualityNotes"] = [];
  const seenSkills = new Set<string>();
  const seenPoints = new Set<string>();
  const seenQuality = new Set<string>();
  const addQuality = (bucket: "input_limitation" | "extraction_uncertainty", title: string, evidence: string) => {
    const category = qualityCategory(`${title} ${evidence}`);
    // The bucket is metadata for the same underlying issue; it must not cause
    // duplicate cards when one legacy response labels it differently.
    const key = category;
    if (seenQuality.has(key)) return;
    seenQuality.add(key);
    qualityNotes.push({ id: `quality-${qualityNotes.length + 1}`, bucket, title: qualityTitle(category, bucket), evidence: clip(evidence) });
  };
  for (const issue of input.preflightIssues ?? []) addQuality(issue.bucket, issue.description, issue.evidenceQuote ?? issue.description);
  for (const note of result.dataQualityNotes) addQuality(note.bucket, note.title, note.evidence);
  for (const finding of result.findings) {
    if (finding.title === "Data quality review" || finding.title === "Extraction flag" || /^data quality|^extraction flag/iu.test(finding.title)) {
      const bucket = /^input_limitation:/iu.test(finding.evidence) ? "input_limitation" : "extraction_uncertainty";
      addQuality(bucket, finding.title, finding.evidence);
      continue;
    }
    if (finding.kind === "STRENGTH") {
      const key = dedupKey(finding.evidence);
      if (seenSkills.has(key)) continue;
      seenSkills.add(key);
      skills.push({ ...finding, title: "Skill found" });
      continue;
    }
    const title = criterionTitleFromPublishedTitle(finding.title);
    const key = `${title}|${dedupKey(finding.evidence)}`;
    if (seenPoints.has(key)) continue;
    seenPoints.add(key);
    points.push({ ...finding, title });
  }
  // Some older/local adapters return a valid assessment without STRENGTH
  // findings even though the deterministic matcher supplied verbatim skill
  // evidence. Preserve that evidence instead of rendering an empty strengths
  // column. Only evidence whose title is one of the job criteria is promoted.
  const criteria = [...(input.requiredSkills ?? []), ...(input.preferredSkills ?? [])].map(dedupKey).filter(Boolean);
  for (const item of input.evidence) {
    const title = dedupKey(item.title);
    if (!title || item.title === "Candidate profile" || !criteria.some((criterion) => criterion === title || criterion.includes(title) || title.includes(criterion))) continue;
    if (seenSkills.has(title)) continue;
    seenSkills.add(title);
    skills.push({ id: `evidence-skill-${skills.length + 1}`, kind: "STRENGTH", title: "Skill found", evidence: clip(item.excerpt) });
  }
  const severeQuality = qualityNotes.some((note) => ["Employment dates", "Duplicate profile records", "Missing responsibilities", "Profile data quality"].includes(note.title));
  const limited = result.assessmentLimitedByDataQuality || (qualityNotes.length > 0 && (severeQuality || result.confidencePercent < 75));
  return {
    ...result,
    requiresHumanReview: result.requiresHumanReview || result.confidencePercent < 75 || limited,
    confidenceLevel: result.confidencePercent < 75 ? "LOW" : result.confidenceLevel,
    confidenceLabel: result.confidencePercent < 75 ? "Human review required" : result.confidenceLabel,
    humanReviewGuidance: limited
      ? "Assessment is limited by CV data quality. Review the notes in the CV & Cover letter tab before using the score."
      : result.humanReviewGuidance,
    overallSummary: limited
      ? "Low data quality — assessment limited. The CV could not be assessed reliably; manual review is required."
      : result.overallSummary,
    assessmentLimitedByDataQuality: limited,
    dataQualityNotes: qualityNotes.slice(0, 30),
    findings: [...skills, ...(limited ? points.slice(0, 2) : points)].slice(0, 50),
    questions: limited
      ? { kind: "INSUFFICIENT_DATA", fallbackMessage: "Suggested questions are unavailable because CV data quality is too low for a reliable assessment." }
      : result.questions,
  };
}

function criterionTitleFromPublishedTitle(value: string): string {
  if (value === "required_skills_match") return "Required skills match";
  if (value === "experience_match") return "Experience match";
  if (value === "preferred_skills_match") return "Preferred skills match";
  if (value === "education_certifications") return "Education and certifications";
  if (value === "languages") return "Language proficiency";
  return value;
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export class ApprovedAiAssessmentAdapter implements AiAssessmentProviderPort {
  private consecutiveFailures = 0;
  private circuitOpenedAt: number | null = null;

  constructor(private readonly transport: Transport = approvedOpenAiTransport) {}

  async assess(input: AiAssessmentProviderInput): Promise<AiAssessment> {
    if (this.circuitOpenedAt !== null && Date.now() - this.circuitOpenedAt < scoringProviderConfig.circuitResetMilliseconds) {
      throw new AiAssessmentProviderError("AI_PROVIDER_CIRCUIT_OPEN", true);
    }
    for (let attempt = 1; attempt <= scoringProviderConfig.maxAttempts; attempt++) {
      try {
        const raw = await Promise.race([
          this.transport(redactProviderInput(input)),
          new Promise<never>((_, reject) => setTimeout(() => reject(new AiAssessmentProviderError("AI_PROVIDER_TIMEOUT", true)), scoringProviderConfig.timeoutMilliseconds)),
        ]);
        const parsed = aiAssessmentSchema.safeParse(raw);
        if (parsed.success) {
          this.consecutiveFailures = 0;
          this.circuitOpenedAt = null;
          return canonicalizeAiAssessment(parsed.data, input);
        }
        const candidate = cvAiAssessmentV4Schema.safeParse(raw);
        if (!candidate.success) throw new AiAssessmentProviderError("AI_PROVIDER_MALFORMED");
        const normalized = toAiAssessment(candidate.data, input);
        this.consecutiveFailures = 0;
        this.circuitOpenedAt = null;
        return normalized;
      } catch (error) {
        const providerError = error instanceof AiAssessmentProviderError
          ? error
          : new AiAssessmentProviderError("AI_PROVIDER_UNAVAILABLE", true);
        this.consecutiveFailures += 1;
        if (this.consecutiveFailures >= scoringProviderConfig.circuitFailureThreshold) this.circuitOpenedAt = Date.now();
        const canRetry = providerError.transient && attempt < scoringProviderConfig.maxAttempts;
        if (!canRetry) {
          if (attempt > 1 && providerError.transient) throw new AiAssessmentProviderError("AI_PROVIDER_RETRY_EXHAUSTED", true);
          throw providerError;
        }
        await sleep(Math.min(500 * 2 ** (attempt - 1), 2_000));
      }
    }
    throw new AiAssessmentProviderError("AI_PROVIDER_RETRY_EXHAUSTED", true);
  }
}

function redactProviderInput(input: AiAssessmentProviderInput): AiAssessmentProviderInput {
  const redact = (value: string | undefined) => {
    if (value === undefined) return undefined;
    // The previous phone pattern also matched ISO dates such as
    // `0634-06-01`. Protect date tokens before PII redaction and restore them
    // afterwards so the provider receives usable employment dates.
    const dates: string[] = [];
    const protectedValue = value.replace(/\b\d{4}-\d{2}-\d{2}\b/gu, (date) => {
      const token = `__SMART_HIRE_DATE_${dates.length}__`;
      dates.push(date);
      return token;
    });
    const redacted = protectedValue
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[email redacted]")
      .replace(/(?:\+?\d[\d ()-]{7,}\d)/gu, "[phone redacted]");
    return redacted.replace(/__SMART_HIRE_DATE_(\d+)__/gu, (_match, index: string) => dates[Number(index)] ?? _match);
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
