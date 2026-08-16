import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import skillAliases from "../src/backend/scoring/domain/skill-aliases.json" with { type: "json" };

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDirectory, "..");
const datasetPath = path.join(webRoot, "data/CV/cv_scoring_dataset.json");
const pdfRoot = path.join(webRoot, "data/CV/pdfs");
const reportPath = path.join(webRoot, "data/CV/manual-baseline-report.json");

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/gu, "d")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

const normalizedSkillAliases = Object.fromEntries(
  Object.entries(skillAliases).map(([label, aliases]) => [normalize(label), aliases]),
);

function normalizeForSearch(value) {
  let normalizedText = "";
  const originalIndexByOffset = [];
  let originalIndex = 0;
  for (const character of value) {
    const decomposed = character
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[đĐ]/gu, "d")
      .toLocaleLowerCase("en-US");
    const safe = [...decomposed]
      .map((part) => /[\p{L}\p{N}+#.]/u.test(part) ? part : " ")
      .join("");
    normalizedText += safe;
    for (let offset = 0; offset < safe.length; offset += 1) originalIndexByOffset.push(originalIndex);
    originalIndex += character.length;
  }
  return { value: normalizedText, originalIndexByOffset };
}

function sentenceContext(text, index, term) {
  const previousBoundary = Math.max(
    text.lastIndexOf(".", index - 1),
    text.lastIndexOf("!", index - 1),
    text.lastIndexOf("?", index - 1),
    text.lastIndexOf("\n", index - 1),
  );
  const nextCandidates = [
    text.indexOf(".", index + term.length),
    text.indexOf("!", index + term.length),
    text.indexOf("?", index + term.length),
    text.indexOf("\n", index + term.length),
  ].filter((candidate) => candidate >= 0);
  const start = previousBoundary + 1;
  const end = nextCandidates.length ? Math.min(...nextCandidates) + 1 : text.length;
  const sentence = text.slice(start, end).trim();
  const termIndex = Math.max(0, sentence.toLocaleLowerCase("en-US").indexOf(term.toLocaleLowerCase("en-US")));
  return { sentence, termIndex };
}

function shouldIgnoreEvidence(text, index, term, label) {
  const context = sentenceContext(text, index, term);
  const beforeTerm = context.sentence.slice(0, context.termIndex);
  const normalizedLabel = normalize(label);
  const negativeExperience = /\b(?:no|without|never|did not|does not|do not|don't|not yet|lack(?:ed)?|lacking)\b[^.!?\n]{0,120}\b(?:experience|background|exposure|skills?|knowledge)\b/iu;
  if (negativeExperience.test(beforeTerm)) return true;
  if (
    normalizedLabel === "english proficiency" &&
    /\b(?:elementary|very limited|limited|self-study|no certificate|basic)\b/iu.test(context.sentence)
  ) return true;
  if (/\b(?:very limited|limited|no formal|no professional|not yet)\b/iu.test(context.sentence)) return true;
  return false;
}

function hasSkillEvidence(text, searchText, label) {
  const normalizedLabel = normalize(label);
  const aliases = normalizedSkillAliases[normalizedLabel] ?? [];
  return [...new Set([label, ...aliases])].some((term) => {
    const parts = normalize(term).split(" ").map(escapeRegExp);
    if (!parts.length || !parts[0]) return false;
    const expression = new RegExp(
      `(?:^|[^\\p{L}\\p{N}+#.])${parts.join("[^\\p{L}\\p{N}+#.]+")}(?=$|[^\\p{L}\\p{N}+#.])`,
      "giu",
    );
    let match;
    while ((match = expression.exec(searchText.value)) !== null) {
      if (match.index === undefined) continue;
      const leadingOffset = match[0].search(/[\p{L}\p{N}+#.]/u);
      const normalizedIndex = match.index + Math.max(leadingOffset, 0);
      const originalIndex = searchText.originalIndexByOffset[normalizedIndex] ?? normalizedIndex;
      if (!shouldIgnoreEvidence(text, originalIndex, term, label)) return true;
    }
    return false;
  });
}

function minimumExperienceYears(value) {
  const match = String(value ?? "").match(/\d+(?:\.\d+)?/u);
  return match ? Number(match[0]) : null;
}

function detectedExperienceYears(text) {
  const yearValues = [...text.matchAll(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/giu)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));
  const monthValues = [...text.matchAll(/(\d+(?:\.\d+)?)\s*\+?\s*(?:months?|mos?)/giu)]
    .map((match) => Number(match[1]) / 12)
    .filter((value) => Number.isFinite(value));
  const values = [...yearValues, ...monthValues];
  return values.length ? Math.max(...values) : null;
}

function scoreLevel(score) {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

async function extractPdf(filePath) {
  const document = await getDocument({ data: new Uint8Array(await readFile(filePath)) }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pages.join("\n").normalize("NFKC").trim();
}

const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
if (!Array.isArray(dataset)) throw new Error("DATASET_MUST_BE_AN_ARRAY");

const records = [];
for (const record of dataset) {
  const cvText = await extractPdf(path.join(pdfRoot, record.cv_pdf_file));
  const searchText = normalizeForSearch(cvText);
  const requiredSkills = Array.isArray(record.job_snapshot?.skill_tags)
    ? record.job_snapshot.skill_tags.filter((skill) => typeof skill === "string" && skill.trim())
    : [];
  const foundSkills = requiredSkills.filter((skill) => hasSkillEvidence(cvText, searchText, skill));
  const minimumYears = minimumExperienceYears(record.job_snapshot?.experience_required);
  const detectedYears = detectedExperienceYears(cvText);
  const requiredSkillPoints = requiredSkills.length === 0 ? 75 : (foundSkills.length / requiredSkills.length) * 75;
  const experiencePoints = minimumYears === null || minimumYears <= 0
    ? 25
    : detectedYears === null
      ? 0
      : Math.min(25, (detectedYears / Math.max(minimumYears, 1)) * 25);
  const automaticScore = Math.round(Math.min(100, requiredSkillPoints + experiencePoints) * 10) / 10;
  const absoluteDelta = Math.abs(automaticScore - Number(record.total_score));
  records.push({
    cv_id: record.cv_id,
    cv_pdf_file: record.cv_pdf_file,
    required_skill_count: requiredSkills.length,
    found_required_skill_count: foundSkills.length,
    found_required_skills: foundSkills,
    minimum_experience_years: minimumYears,
    detected_experience_years: detectedYears,
    automatic_score: automaticScore,
    ground_truth_score: record.total_score,
    absolute_delta: Number(absoluteDelta.toFixed(1)),
    automatic_match_level: scoreLevel(automaticScore),
    ground_truth_match_level: record.match_level,
    match_level_mismatch: scoreLevel(automaticScore) !== record.match_level,
  });
}

const absoluteDeltas = records.map((record) => record.absolute_delta);
const flagged = records.filter((record) => record.absolute_delta > 10 || record.match_level_mismatch);
const report = {
  generated_at: new Date().toISOString(),
  method: "manual-deterministic-auto-match-v3",
  description: "Offline baseline matching the production automatic matcher: controlled normalized/semantic skill aliases (75 points) plus detected experience (25 points). No AI provider was called.",
  rubric: { required_skills: 75, experience: 25 },
  dataset: { records: records.length, pdf_directory: path.relative(webRoot, pdfRoot) },
  metrics: {
    mean_absolute_error: Number((absoluteDeltas.reduce((sum, value) => sum + value, 0) / records.length).toFixed(2)),
    max_absolute_error: Math.max(...absoluteDeltas),
    within_10_points: records.filter((record) => record.absolute_delta <= 10).length,
    flagged_over_10_points_or_boundary: flagged.length,
    match_level_mismatches: records.filter((record) => record.match_level_mismatch).length,
  },
  flagged_records: flagged,
  records,
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  report: reportPath,
  records: report.dataset.records,
  metrics: report.metrics,
}));
