import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import mammoth from "mammoth";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDirectory, "..");
const datasetPath = path.join(webRoot, "data/CV/cv_scoring_dataset.json");
const pdfRoot = path.join(webRoot, "data/CV/pdfs");
const rubric = Object.freeze({
  experience_match: 30,
  skills_match: 25,
  education_match: 15,
  language_match: 10,
  role_relevance: 20,
});
const predictionRubric = Object.freeze({
  required_skills_match: 40,
  experience_match: 25,
  preferred_skills_match: 15,
  education_certifications: 10,
  languages: 10,
});

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function fold(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function scoreLevel(score) {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function scoreBreakdown(record) {
  const breakdown = record?.score_breakdown;
  if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) {
    return { valid: false, errors: ["score_breakdown is missing"] };
  }
  const errors = [];
  let total = 0;
  for (const [key, maximum] of Object.entries(rubric)) {
    const value = breakdown[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) {
      errors.push(`${key} must be a number between 0 and ${maximum}`);
    } else {
      total += value;
    }
  }
  if (typeof record.total_score !== "number" || !Number.isFinite(record.total_score) || record.total_score < 0 || record.total_score > 100) {
    errors.push("total_score must be a number between 0 and 100");
  } else if (Math.abs(total - record.total_score) > 0.1) {
    errors.push(`total_score ${record.total_score} does not equal breakdown sum ${total}`);
  }
  if (record.match_level !== scoreLevel(record.total_score)) {
    errors.push(`match_level ${record.match_level} does not match total_score ${record.total_score}`);
  }
  return { valid: errors.length === 0, errors, total };
}

function predictionScoreBreakdown(record) {
  const breakdown = record?.score_breakdown;
  const rubricToUse = breakdown && typeof breakdown === "object" && Object.prototype.hasOwnProperty.call(breakdown, "required_skills_match")
    ? predictionRubric
    : rubric;
  const errors = [];
  let total = 0;
  if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) return { valid: false, errors: ["score_breakdown is missing"] };
  for (const [key, maximum] of Object.entries(rubricToUse)) {
    const value = breakdown[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) errors.push(`${key} must be a number between 0 and ${maximum}`);
    else total += value;
  }
  if (typeof record.total_score !== "number" || !Number.isFinite(record.total_score) || record.total_score < 0 || record.total_score > 100) errors.push("total_score must be a number between 0 and 100");
  else if (Math.abs(total - record.total_score) > 0.1) errors.push(`total_score ${record.total_score} does not equal breakdown sum ${total}`);
  if (record.match_level !== scoreLevel(record.total_score)) errors.push(`match_level ${record.match_level} does not match total_score ${record.total_score}`);
  if (Object.prototype.hasOwnProperty.call(breakdown, "required_skills_match")) {
    if (!record.extraction || typeof record.extraction !== "object") errors.push("v4 extraction is missing");
    if (typeof record.confidence_pct !== "number" || record.confidence_pct < 0 || record.confidence_pct > 100) errors.push("confidence_pct must be between 0 and 100");
    if (record.confidence_pct < 75 && record.requires_human_review !== true) errors.push("confidence below 75 requires_human_review=true");
  }
  return { valid: errors.length === 0, errors, total, rubric: rubricToUse === predictionRubric ? "ai_prompt_v4" : "dataset" };
}

async function extractPdf(filePath) {
  const source = new Uint8Array(await readFile(filePath));
  const document = await getDocument({ data: source }).promise;
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent({ disableNormalization: false });
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .normalize("NFKC")
        .replace(/\s+/gu, " ")
        .trim();
      if (text) pages.push(text);
      page.cleanup();
    }
    return { text: pages.join("\n"), pages: document.numPages };
  } finally {
    await document.cleanup();
  }
}

async function extractDocx(filePath) {
  const result = await mammoth.extractRawText({ buffer: await readFile(filePath) });
  return {
    text: result.value.normalize("NFKC").replace(/\s+/gu, " ").trim(),
    pages: null,
  };
}

async function extractDocument(filePath) {
  const extension = path.extname(filePath).toLocaleLowerCase("en-US");
  if (extension === ".pdf") return extractPdf(filePath);
  if (extension === ".docx") return extractDocx(filePath);
  throw new Error(`UNSUPPORTED_FILE_TYPE:${extension}`);
}

async function loadPredictions(predictionsPath) {
  if (!predictionsPath) return new Map();
  const decoded = JSON.parse(await readFile(path.resolve(predictionsPath), "utf8"));
  const records = Array.isArray(decoded) ? decoded : decoded?.predictions;
  if (!Array.isArray(records)) throw new Error("PREDICTIONS_MUST_BE_AN_ARRAY");
  return new Map(records.filter((record) => record && typeof record.cv_id === "string").map((record) => [record.cv_id, record]));
}

async function main() {
  if (hasFlag("--help")) {
    console.log("Usage: node scripts/validate-cv-scoring-dataset.mjs [--predictions file] [--strict] [--pretty]");
    console.log("The script never calls an AI provider. Pass a prediction JSON array to run the >10-point/boundary comparison.");
    return;
  }
  const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
  if (!Array.isArray(dataset)) throw new Error("DATASET_MUST_BE_AN_ARRAY");
  const fileNames = (await readdir(pdfRoot)).filter((name) => /\.(?:pdf|docx)$/iu.test(name)).sort();
  const fileSet = new Set(fileNames);
  const structuralErrors = [];
  const seenIds = new Set();
  const seenFiles = new Set();
  dataset.forEach((record) => {
    const errors = [];
    if (!record || typeof record !== "object") {
      structuralErrors.push({ cv_id: null, message: "record is not an object" });
      return;
    }
    if (typeof record.cv_id !== "string" || !record.cv_id) errors.push("cv_id is missing");
    if (seenIds.has(record.cv_id)) errors.push("duplicate cv_id");
    seenIds.add(record.cv_id);
    if (typeof record.cv_pdf_file !== "string" || !record.cv_pdf_file) errors.push("cv_pdf_file is missing");
    if (seenFiles.has(record.cv_pdf_file)) errors.push("duplicate cv_pdf_file");
    seenFiles.add(record.cv_pdf_file);
    const score = scoreBreakdown(record);
    errors.push(...score.errors);
    if (!Array.isArray(record.scoring_reasons) || record.scoring_reasons.length < 3 || record.scoring_reasons.length > 5) errors.push("scoring_reasons must contain 3-5 items");
    structuralErrors.push(...errors.map((message) => ({ cv_id: record.cv_id ?? null, message })));
  });

  const missingFiles = dataset.filter((record) => !fileSet.has(record?.cv_pdf_file)).map((record) => ({ cv_id: record?.cv_id ?? null, file: record?.cv_pdf_file ?? null }));
  const extraFiles = fileNames.filter((file) => !seenFiles.has(file));
  const extraction = [];
  for (const record of dataset) {
    if (!record || typeof record.cv_pdf_file !== "string" || !fileSet.has(record.cv_pdf_file)) continue;
    const filePath = path.join(pdfRoot, record.cv_pdf_file);
    try {
      const parsed = await extractDocument(filePath);
      const expectedName = fold(record.candidate_name);
      const normalizedText = fold(parsed.text);
      const expectedNamePresent = Boolean(expectedName) && normalizedText.includes(expectedName);
      const contentOwner = dataset.find((candidate) => {
        const name = fold(candidate?.candidate_name);
        return name && normalizedText.includes(name);
      })?.cv_id ?? null;
      extraction.push({
        cv_id: record.cv_id,
        file: record.cv_pdf_file,
        pages: parsed.pages,
        characters: parsed.text.length,
        textPresent: parsed.text.length > 0,
        expectedNamePresent,
        contentOwner,
        status: !parsed.text ? "EMPTY_TEXT" : contentOwner && contentOwner !== record.cv_id ? "CONTENT_FILE_MISMATCH" : expectedNamePresent ? "OK" : "EXPECTED_NAME_NOT_FOUND",
      });
    } catch (error) {
      extraction.push({ cv_id: record.cv_id, file: record.cv_pdf_file, status: "PARSE_FAILED", error: error instanceof Error ? error.message : String(error) });
    }
  }

  const predictions = await loadPredictions(argumentValue("--predictions"));
  const flaggedPredictions = [];
  const predictionErrors = [];
  if (predictions.size) {
    for (const record of dataset) {
      const prediction = predictions.get(record?.cv_id);
      if (!prediction) {
        predictionErrors.push({ cv_id: record?.cv_id ?? null, message: "prediction is missing" });
        continue;
      }
      const validation = predictionScoreBreakdown(prediction);
      if (!validation.valid) predictionErrors.push({ cv_id: record.cv_id, message: validation.errors.join("; ") });
      const scoreDelta = Math.abs(Number(prediction.total_score) - Number(record.total_score));
      const levelMismatch = prediction.match_level !== record.match_level;
      if (scoreDelta > 10 || levelMismatch) flaggedPredictions.push({
        cv_id: record.cv_id,
        expected: { total_score: record.total_score, match_level: record.match_level },
        predicted: { total_score: prediction.total_score, match_level: prediction.match_level },
        scoreDelta,
        levelMismatch,
      });
    }
  }

  const sourceErrors = [
    ...missingFiles.map((item) => ({ ...item, message: "source file is missing" })),
    ...extraction.filter((item) => item.status !== "OK").map((item) => ({ cv_id: item.cv_id, file: item.file, message: item.status })),
  ];
  const report = {
    generated_at: new Date().toISOString(),
    rubric,
    dataset: { expected_records: 25, actual_records: dataset.length, pdf_or_docx_files: fileNames.length },
    structural: { valid: structuralErrors.length === 0, errors: structuralErrors, extra_files: extraFiles },
    source_alignment: { valid: sourceErrors.length === 0, missing_files: missingFiles, extra_files: extraFiles, records: extraction, errors: sourceErrors },
    prediction_validation: predictions.size
      ? { supplied: true, prediction_count: predictions.size, rubric: "ai_prompt_v4_or_dataset", valid_prediction_records: predictionErrors.length === 0, errors: predictionErrors, flagged_over_10_points_or_boundary: flaggedPredictions }
      : { supplied: false, message: "No predictions supplied; run again with --predictions <file> after the model has been evaluated." },
  };
  console.log(JSON.stringify(report, null, hasFlag("--pretty") ? 2 : 0));
  if (hasFlag("--strict") && (structuralErrors.length || sourceErrors.length || predictionErrors.length || flaggedPredictions.length)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
