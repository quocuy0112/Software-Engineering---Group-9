import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDirectory, "..");
const datasetPath = path.join(webRoot, "data/CV/cv_scoring_dataset.json");
const pdfRoot = path.join(webRoot, "data/CV/pdfs");
const defaultOutputPath = path.join(webRoot, "data/CV/predictions.json");
let buildCvAiAssessmentPrompt;
let cvAiAssessmentJsonSchema;
let cvAiAssessmentV4Schema;

dotenv.config({ path: path.join(webRoot, ".env") });
dotenv.config({ path: path.join(webRoot, ".env.local"), override: true });

const model = process.env.SCORING_AI_MODEL_VERSION
  ?? process.env.CV_OPENAI_MODEL
  ?? "gpt-5.4-mini-2026-03-17";
const evaluationDate = process.env.CV_EVALUATION_CURRENT_DATE
  ?? new Date().toISOString().slice(0, 10);

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function evaluationLimit(datasetLength) {
  const raw = argumentValue("--limit");
  if (raw === undefined) return datasetLength;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error("--limit must be a positive integer");
  return Math.min(value, datasetLength);
}

function minimumExperienceYears(value) {
  const match = String(value ?? "").match(/\d+(?:\.\d+)?/u);
  return match ? Number(match[0]) : null;
}

function redacted(value) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[email redacted]")
    .replace(/(?:\+?\d[\d ()-]{7,}\d)/gu, "[phone redacted]");
}

async function extractPdf(filePath) {
  const document = await getDocument({ data: new Uint8Array(await readFile(filePath)) }).promise;
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
      page.cleanup();
    }
    return pages.join("\n").normalize("NFKC").trim();
  } finally {
    await document.cleanup();
  }
}

function assertExternalEvaluationAllowed() {
  if (!hasFlag("--allow-external-cv")) {
    throw new Error("EXTERNAL_CV_EVALUATION_REQUIRES --allow-external-cv");
  }
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");
  const approved = ["CV_OPENAI_DPA_APPROVED", "CV_OPENAI_CROSS_BORDER_APPROVED", "CV_OPENAI_ZDR_APPROVED"]
    .every((name) => process.env[name]?.toLocaleLowerCase("en-US") === "true");
  const localDevelopmentGate = process.env.APP_ENV === "local"
    && process.env.CV_OPENAI_LOCAL_DEV_ENABLED?.toLocaleLowerCase("en-US") === "true";
  const externalEnabled = (process.env.SCORING_AI_ENABLED ?? process.env.CV_OPENAI_ENABLED)
    ?.toLocaleLowerCase("en-US") === "true";
  if (!externalEnabled || (!approved && !localDevelopmentGate)) {
    throw new Error("EXTERNAL_CV_EVALUATION_POLICY_NOT_APPROVED");
  }
}

async function requestScore(input) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          background: false,
          store: false,
          stream: false,
          reasoning: { effort: "none" },
          truncation: "disabled",
          max_output_tokens: 12_000,
          instructions: buildCvAiAssessmentPrompt(input),
          input: "Return the structured JSON assessment now.",
          text: { format: { type: "json_schema", name: "ai_cv_assessment_v4", strict: true, schema: cvAiAssessmentJsonSchema } },
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        const body = await response.text();
        const error = new Error(`OPENAI_HTTP_${response.status}:${body.slice(0, 300)}`);
        if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 3) throw error;
        lastError = error;
      } else {
        const body = await response.json();
        const text = body.output_text
          ?? body.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("");
        if (!text) throw new Error("AI_PROVIDER_MALFORMED");
        const parsed = cvAiAssessmentV4Schema.safeParse(JSON.parse(text));
        if (!parsed.success) throw new Error(`AI_SCHEMA_INVALID:${parsed.error.issues.map((issue) => issue.path.join(".") + " " + issue.message).join("; ")}`);
        return parsed.data;
      }
    } catch (error) {
      lastError = error;
      if (attempt === 3) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
  }
  throw lastError ?? new Error("AI_PROVIDER_RETRY_EXHAUSTED");
}

if (hasFlag("--help")) {
  console.log("Usage: node scripts/evaluate-cv-scoring-dataset.mjs --allow-external-cv [--limit N] [--output file]");
  console.log("Each selected CV is sent as one OpenAI Responses request and written as a v4 prediction.");
  process.exit(0);
}

assertExternalEvaluationAllowed();
({ buildCvAiAssessmentPrompt, cvAiAssessmentJsonSchema, cvAiAssessmentV4Schema } = await import("../src/backend/scoring/domain/cv-ai-assessment.ts"));
const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
if (!Array.isArray(dataset)) throw new Error("DATASET_MUST_BE_AN_ARRAY");
const outputPath = path.resolve(argumentValue("--output") ?? defaultOutputPath);
const predictions = [];
const limit = evaluationLimit(dataset.length);

for (const record of dataset.slice(0, limit)) {
  const cvText = await extractPdf(path.join(pdfRoot, record.cv_pdf_file));
  if (!cvText) throw new Error(`CV_TEXT_EMPTY:${record.cv_id}`);
  const snapshot = record.job_snapshot ?? {};
  const result = await requestScore({
    jobTitle: record.job_title,
    requiredSkills: Array.isArray(snapshot.skill_tags) ? snapshot.skill_tags : [],
    preferredSkills: [],
    keyRequirements: Array.isArray(snapshot.key_requirements) ? snapshot.key_requirements : [],
    minimumExperienceYears: minimumExperienceYears(snapshot.experience_required),
    requiredLanguages: [],
    currentDate: evaluationDate,
    cvText: redacted(cvText),
    coverLetterText: "",
  });
  predictions.push({ cv_id: record.cv_id, cv_pdf_file: record.cv_pdf_file, ...result });
  console.log(JSON.stringify({ cv_id: record.cv_id, total_score: result.total_score, match_level: result.match_level, confidence_pct: result.confidence_pct }));
}

await writeFile(outputPath, `${JSON.stringify(predictions, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: outputPath, predictions: predictions.length, datasetRecords: dataset.length, model, prompt: "prompt-v4-ai-cv-assessment", currentDate: evaluationDate }));
