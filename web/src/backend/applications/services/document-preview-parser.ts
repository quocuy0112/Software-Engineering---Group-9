import "server-only";

import type { ExtractedSegment } from "@/backend/cv/extraction/document-extractor";
import {
  structuredCoverLetterPreviewSchema,
  structuredCvPreviewSchema,
  type DocumentQualityNote,
  type StructuredCoverLetterPreview,
  type StructuredCvPreview,
} from "@/shared/contracts/applications/document-preview";

export const DOCUMENT_PREVIEW_PARSER_VERSION = "structured-preview-v2";

type PreviewSegment = Pick<ExtractedSegment, "id" | "kind" | "text">;

type JsonRecord = Record<string, unknown>;

const sectionNames = [
  "professional summary",
  "professional profile",
  "career objective",
  "work experience",
  "professional experience",
  "employment history",
  "certifications",
  "languages",
  "education",
  "experience",
  "summary",
  "profile",
  "about me",
  "technical skills",
  "skills",
] as const;

type SectionName =
  | "intro"
  | "summary"
  | "experience"
  | "skills"
  | "education"
  | "certifications"
  | "languages";

function object(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function text(value: unknown, maximum = 5_000): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .normalize("NFKC")
    .replace(/\r\n?/gu, "\n")
    .replace(/[ \t]+/gu, " ")
    .trim();
  const withoutControls = Array.from(normalized, (character) => {
    const code = character.charCodeAt(0);
    return code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31)
      ? " "
      : character;
  }).join("");
  return withoutControls ? withoutControls.slice(0, maximum) : null;
}

function unique(values: readonly (string | null)[]) {
  return [...new Set(values.flatMap((value) => (value ? [value] : [])))];
}

function list(value: unknown, maximum = 50): string[] {
  if (!Array.isArray(value)) return [];
  return unique(value.map((item) => text(item, 200))).slice(0, maximum);
}

function note(
  id: string,
  title: string,
  evidence: string,
  severity: DocumentQualityNote["severity"] = "MINOR",
): DocumentQualityNote {
  return {
    id,
    title,
    evidence,
    severity,
    bucket: "extraction_uncertainty",
  };
}

function formatDate(value: unknown): string | null {
  const source = text(value, 40);
  if (!source) return null;
  const match = source.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (match) return `${match[2]}/${match[1]}`;
  return source;
}

function period(value: JsonRecord): string | null {
  const start = formatDate(value.startDate);
  const end = value.isCurrent === true ? "Present" : formatDate(value.endDate);
  if (!start && !end) return null;
  if (!start) return end;
  if (!end) return start;
  return `${start} – ${end}`;
}

function splitBullets(value: unknown): string[] {
  const source = text(value, 3_000);
  if (!source) return [];
  return source
    .split(/\n+|[•▪◦]\s*/u)
    .flatMap((part) =>
      part
        .split(/\s*;\s*(?=[A-Z])/u)
        .map((item) => text(item, 500))
        .filter((item): item is string => Boolean(item)),
    )
    .slice(0, 20);
}

function profilePreview(snapshot: unknown): StructuredCvPreview | null {
  const root = object(snapshot);
  if (!root) return null;
  const name = text(root.candidateName ?? root.name, 200);
  const title = text(root.headline ?? root.title, 200);
  const summary = text(root.summary, 5_000);
  const contact = unique([
    text(root.email, 160),
    text(root.phone, 80),
    text(root.location, 160),
  ]);
  const experience = Array.isArray(root.experience)
    ? root.experience.flatMap((raw) => {
        const value = object(raw);
        if (!value) return [];
        const role = text(value.title ?? value.role, 200);
        if (!role) return [];
        return [
          {
            role,
            company: text(value.company, 200),
            dates: period(value),
            bullets: splitBullets(value.description),
          },
        ];
      })
    : [];
  const education = Array.isArray(root.education)
    ? root.education.flatMap((raw) => {
        const value = object(raw);
        const institution = value ? text(value.institution, 200) : null;
        if (!value || !institution) return [];
        const degree = unique([
          text(value.degree, 200),
          text(value.field, 200),
        ]).join(" · ");
        return [
          {
            institution,
            degree: degree || null,
            dates: period(value),
          },
        ];
      })
    : [];
  const skills = Array.isArray(root.skills)
    ? unique(
        root.skills.map((value) => {
          const item = object(value);
          return text(
            item?.label ?? item?.displayName ?? item?.name ?? value,
            80,
          );
        }),
      ).slice(0, 50)
    : [];
  const certifications = list(root.certifications ?? root.certificates, 30);
  const languages = list(root.languages, 30);
  if (
    !name &&
    !title &&
    !summary &&
    !contact.length &&
    !experience.length &&
    !education.length &&
    !skills.length
  )
    return null;

  const qualityNotes: DocumentQualityNote[] = [];
  if (!name)
    qualityNotes.push(
      note(
        "cv-name-missing",
        "Candidate name",
        "No confident name field was available in the structured CV data.",
      ),
    );
  if (!title)
    qualityNotes.push(
      note(
        "cv-title-missing",
        "Job title",
        "No confident headline or job title was available in the structured CV data.",
      ),
    );
  if (!experience.length)
    qualityNotes.push(
      note(
        "cv-experience-missing",
        "Experience section",
        "No structured experience entry was available; verify the original CV.",
      ),
    );
  if (!skills.length)
    qualityNotes.push(
      note(
        "cv-skills-missing",
        "Skills section",
        "No structured skills were available; verify the original CV.",
      ),
    );

  return structuredCvPreviewSchema.parse({
    kind: "cv",
    name,
    title,
    contact,
    summary,
    experience,
    education,
    skills,
    certifications,
    languages,
    qualityNotes,
  });
}

function sectionName(value: string): SectionName | null {
  const normalized = value.toLocaleLowerCase("en-US").replace(/[:\s]+$/gu, "");
  if (
    [
      "professional summary",
      "professional profile",
      "career objective",
      "summary",
      "profile",
      "about me",
      "objective",
    ].includes(normalized)
  )
    return "summary";
  if (
    [
      "work experience",
      "professional experience",
      "employment history",
      "experience",
    ].includes(normalized)
  )
    return "experience";
  if (["technical skills", "skills"].includes(normalized)) return "skills";
  if (normalized === "education") return "education";
  if (normalized === "certifications" || normalized === "certification")
    return "certifications";
  if (normalized === "languages" || normalized === "language")
    return "languages";
  return null;
}

// Kept for compatibility with older preview fixtures; the v2 parser below
// handles documents whose PDF extractor returns one continuous text block.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function extractedLinesLegacy(segments: readonly PreviewSegment[]) {
  const headingPattern = new RegExp(
    `(?:^|\\s)(${sectionNames
      .slice()
      .sort((left, right) => right.length - left.length)
      .map((value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
      .join("|")})(?=\\s|:|$)`,
    "giu",
  );
  const textValue = segments
    .map((segment) => segment.text)
    .join("\n")
    .normalize("NFKC")
    .replace(/[•▪◦]/gu, "\n• ")
    .replace(headingPattern, "\n$1\n")
    .replace(/\s{2,}/gu, "\n");
  return textValue
    .split(/\n+/u)
    .map((value) => value.replace(/^\s*[|:]\s*/u, "").trim())
    .filter(Boolean);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseEntryLinesLegacy(values: readonly string[]) {
  const datePattern =
    /(?:\b(?:0?[1-9]|1[0-2])\/\d{4}\b|\b(?:19|20)\d{2}\b).*(?:-|–|—|to|until).*(?:present|\b(?:19|20)\d{2}\b|\b(?:0?[1-9]|1[0-2])\/\d{4}\b)/iu;
  const entries: Array<{
    role: string;
    company: string | null;
    dates: string | null;
    bullets: string[];
  }> = [];
  let current: (typeof entries)[number] | null = null;
  const commit = () => {
    if (current) entries.push(current);
    current = null;
  };
  for (const raw of values) {
    const isBullet = /^[•▪◦*-]\s*/u.test(raw);
    const value = raw.replace(/^[•▪◦*-]\s*/u, "").trim();
    if (!value) continue;
    if (isBullet && current) {
      current.bullets.push(value.slice(0, 500));
      continue;
    }
    if (datePattern.test(value)) {
      if (!current) {
        const withoutDate = value
          .replace(datePattern, "")
          .replace(/^[|,\s-]+|[|,\s-]+$/gu, "")
          .trim();
        current = {
          role: withoutDate || "Experience entry",
          company: null,
          dates: value.match(datePattern)?.[0] ?? null,
          bullets: [],
        };
      } else {
        current.dates = value.match(datePattern)?.[0] ?? current.dates;
      }
      continue;
    }
    if (!current) {
      current = {
        role: value.slice(0, 200),
        company: null,
        dates: null,
        bullets: [],
      };
      continue;
    }
    if (
      !current.company &&
      current.role !== value &&
      current.bullets.length === 0
    ) {
      current.company = value.slice(0, 200);
      continue;
    }
    if (current.dates || current.bullets.length > 0) {
      current.bullets.push(value.slice(0, 500));
    } else {
      current.role = `${current.role} · ${value}`.slice(0, 200);
    }
  }
  commit();
  return entries.slice(0, 50);
}

function extractedLines(segments: readonly PreviewSegment[]) {
  const headingPattern = new RegExp(
    `(?:^|\\s)(${sectionNames
      .slice()
      .sort((left, right) => right.length - left.length)
      .map((value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
      .join("|")})(?=\\s|:|$)`,
    "giu",
  );
  return segments
    .map((segment) => segment.text)
    .join("\n")
    .normalize("NFKC")
    .replace(/[\u2022\u25AA\u25E6]/gu, "\n\u2022 ")
    .replace(headingPattern, (match, heading: string) =>
      /^[A-Z0-9][A-Z0-9\s&/-]*$/u.test(heading) ? `\n${heading}\n` : match,
    )
    .split(/\n+/u)
    .map((value) => value.replace(/^\s*[|:]\s*/u, "").trim())
    .filter(Boolean);
}

function stripBullet(value: string) {
  return value.replace(/^[\s\u2022\u25AA\u25E6*-]+/u, "").trim();
}

function cleanList(values: readonly string[], maximum = 50) {
  return unique(
    values.flatMap((value) => {
      const normalized = stripBullet(value);
      if (!normalized) return [];
      return [text(normalized, 200)];
    }),
  ).slice(0, maximum);
}

function splitSentences(value: string) {
  return value
    .split(/(?<=[.!?])\s+(?=[A-Z])/u)
    .map((item) => stripBullet(item))
    .filter(Boolean)
    .slice(0, 20)
    .map((item) => item.slice(0, 500));
}

function parseHeader(values: readonly string[]) {
  const source = values.join(" ").replace(/\s+/gu, " ").trim();
  const dateMatch = source.match(
    /\b(?:0?[1-9]|1[0-2])\/\d{4}\s*[-\u2012\u2013\u2014]\s*(?:present|(?:0?[1-9]|1[0-2])\/\d{4}|(?:19|20)\d{2})\b/iu,
  );
  const phone = source.match(
    /(?:dien thoai|phone|tel|telephone)\s*:\s*([+\d][\d ()-]{6,})/iu,
  );
  const email = source.match(
    /(?:email|e-mail)\s*:\s*([\w.+-]+@[\w.-]+\.[A-Z]{2,})/iu,
  );
  const location = source.match(/(?:dia chi|address|location)\s*:\s*(.+)$/iu);
  const contact = unique([
    phone ? `Phone: ${phone[1].trim()}` : null,
    email ? `Email: ${email[1].trim()}` : null,
    location ? `Location: ${location[1].trim()}` : null,
  ]).slice(0, 10);
  const withoutContact = source
    .replace(/(?:dien thoai|phone|tel|telephone)\s*:\s*[+\d][\d ()-]{6,}/iu, "")
    .replace(/(?:email|e-mail)\s*:\s*[\w.+-]+@[\w.-]+\.[A-Z]{2,}/iu, "")
    .replace(/(?:dia chi|address|location)\s*:\s*.+$/iu, "")
    .replace(dateMatch?.[0] ?? /$^/u, "")
    .replace(/\s+/gu, " ")
    .trim();
  const nameMatch = withoutContact.match(
    /\b[A-Z][A-Z0-9]*(?:\s+[A-Z][A-Z0-9]*){1,4}\b/u,
  );
  const name = text(nameMatch?.[0] ?? values[0], 200);
  const title = nameMatch
    ? text(
        withoutContact
          .slice((nameMatch.index ?? 0) + nameMatch[0].length)
          .trim(),
        200,
      )
    : text(values[1], 200);
  return { name, title, contact, dates: dateMatch?.[0] ?? null };
}

function splitExperienceRole(value: string) {
  const match = value.match(
    /^(.+?\b(?:developer|executive|manager|engineer|specialist|officer|designer|consultant|analyst|lead|intern|assistant|director)\b)\s+(.+)$/iu,
  );
  return {
    role: match?.[1] ?? value.split(/\s+/u).slice(0, 3).join(" "),
    company: match?.[2] ?? value,
  };
}

function inlineExperienceEntry(
  values: readonly string[],
  defaultDates: string | null,
) {
  const source = values.map(stripBullet).filter(Boolean).join(" ");
  const dash = source.search(/\s[\u2012\u2013\u2014-]\s/u);
  if (dash < 1) return null;
  const before = source.slice(0, dash).trim();
  const after = source
    .slice(dash)
    .replace(/^\s*[\u2012\u2013\u2014-]\s*/u, "")
    .trim();
  const descriptionStart = after.search(
    /\b(?:planned|managed|led|developed|created|coordinated|tracked|worked|built|designed|implemented)\b/iu,
  );
  if (descriptionStart < 1) return null;
  const location = after.slice(0, descriptionStart).trim();
  const description = after.slice(descriptionStart).trim();
  const split = splitExperienceRole(before);
  const role = text(split.role, 200);
  const company = text(
    `${split.company}${location ? ` - ${location}` : ""}`,
    200,
  );
  if (!role || !company) return null;
  return [
    {
      role,
      company,
      dates: defaultDates,
      bullets: splitSentences(description),
    },
  ];
}

function parseEntryLines(
  values: readonly string[],
  defaultDates: string | null,
) {
  const inline = inlineExperienceEntry(values, defaultDates);
  if (inline) return inline;
  const datePattern =
    /(?:\b(?:0?[1-9]|1[0-2])\/\d{4}\b|\b(?:19|20)\d{2}\b).*(?:[-\u2012\u2013\u2014]|to|until).*(?:present|\b(?:19|20)\d{2}\b|\b(?:0?[1-9]|1[0-2])\/\d{4}\b)/iu;
  const entries: Array<{
    role: string;
    company: string | null;
    dates: string | null;
    bullets: string[];
  }> = [];
  let current: (typeof entries)[number] | null = null;
  const commit = () => {
    if (current) entries.push(current);
    current = null;
  };
  for (const raw of values) {
    const value = stripBullet(raw);
    if (!value) continue;
    if (datePattern.test(value)) {
      if (!current) {
        current = {
          role: value.replace(datePattern, "").trim() || "Experience entry",
          company: null,
          dates: value.match(datePattern)?.[0] ?? defaultDates,
          bullets: [],
        };
      } else {
        current.dates = value.match(datePattern)?.[0] ?? current.dates;
      }
      continue;
    }
    if (!current) {
      current = {
        role: value.slice(0, 200),
        company: null,
        dates: defaultDates,
        bullets: [],
      };
      continue;
    }
    if (!current.company && current.bullets.length === 0) {
      current.company = value.slice(0, 200);
      continue;
    }
    current.bullets.push(...splitSentences(value));
  }
  commit();
  return entries.slice(0, 50);
}

function parseEducation(values: readonly string[]) {
  const source = values.map(stripBullet).filter(Boolean).join(" ");
  if (!source) return [];
  const dates =
    source.match(
      /\b(?:19|20)\d{2}\b(?:\s*[-\u2012\u2013\u2014]\s*(?:present|\b(?:19|20)\d{2}\b))?/iu,
    )?.[0] ?? null;
  const withoutMetadata = source
    .replace(dates ?? /$^/u, "")
    .replace(/\s*\|\s*GPA[^|]*/iu, "")
    .replace(/\s+/gu, " ")
    .trim();
  const suffixes = [
    ...withoutMetadata.matchAll(/\b(College|University|Institute|School)\b/giu),
  ];
  const suffix = suffixes.at(-1);
  const beforeInstitution = suffix
    ? withoutMetadata.slice(0, suffix.index).trim()
    : "";
  const beforeWords = beforeInstitution.split(/\s+/u).filter(Boolean);
  const institutionWordCount = suffix
    ? suffix[1].toLocaleLowerCase("en-US") === "college"
      ? 3
      : 4
    : 0;
  const institution = text(
    suffix
      ? `${beforeWords.slice(-institutionWordCount).join(" ")} ${suffix[1]}`
      : withoutMetadata,
    200,
  );
  const degree = suffix
    ? text(beforeWords.slice(0, -institutionWordCount).join(" "), 200)
    : null;
  return institution ? [{ institution, degree: degree || null, dates }] : [];
}

function rawCvPreview(
  segments: readonly PreviewSegment[],
): StructuredCvPreview {
  const lines = extractedLines(segments);
  const groups = new Map<SectionName, string[]>([
    ["intro", []],
    ["summary", []],
    ["experience", []],
    ["skills", []],
    ["education", []],
    ["certifications", []],
    ["languages", []],
  ]);
  let current: SectionName = "intro";
  let recognizedHeading = false;
  for (const line of lines) {
    const heading = sectionName(line.replace(/:$/u, "").trim());
    if (heading) {
      current = heading;
      recognizedHeading = true;
      continue;
    }
    groups.get(current)?.push(line);
  }

  const intro = groups.get("intro") ?? [];
  const header = parseHeader(intro);
  const name = header.name;
  const title = header.title;
  const contact = header.contact;
  const summary = text((groups.get("summary") ?? []).join(" "), 5_000);
  const experience = parseEntryLines(
    groups.get("experience") ?? [],
    header.dates,
  );
  const skills = cleanList(groups.get("skills") ?? [], 50).map((value) =>
    value.slice(0, 80),
  );
  const education = parseEducation(groups.get("education") ?? []);
  const certifications = cleanList(groups.get("certifications") ?? [], 30);
  const languages = cleanList(groups.get("languages") ?? [], 30).map((value) =>
    value.slice(0, 120),
  );
  const qualityNotes: DocumentQualityNote[] = [];
  if (!recognizedHeading)
    qualityNotes.push(
      note(
        "cv-sections-ambiguous",
        "CV sections",
        "The extracted text did not contain recognizable section headings; some fields may need manual verification.",
        "HIGH",
      ),
    );
  if (!name)
    qualityNotes.push(
      note(
        "cv-name-ambiguous",
        "Candidate name",
        "The first CV block could not be confidently identified as a candidate name.",
      ),
    );
  if (!experience.length && (groups.get("experience") ?? []).length)
    qualityNotes.push(
      note(
        "cv-experience-ambiguous",
        "Experience dates",
        "Experience text was found, but no complete role/date entry could be structured reliably.",
        "HIGH",
      ),
    );
  if (!skills.length && (groups.get("skills") ?? []).length)
    qualityNotes.push(
      note(
        "cv-skills-ambiguous",
        "Skills list",
        "A skills block was found, but its items could not be separated confidently.",
      ),
    );
  return structuredCvPreviewSchema.parse({
    kind: "cv",
    name,
    title,
    contact,
    summary,
    experience,
    education,
    skills,
    certifications,
    languages,
    qualityNotes,
  });
}

function coverLetterPreview(
  segments: readonly PreviewSegment[],
): StructuredCoverLetterPreview {
  const source = segments
    .map((segment) => segment.text)
    .join("\n\n")
    .normalize("NFKC")
    .replace(/\r\n?/gu, "\n")
    .trim();
  const lines = source
    .split(/\n+/u)
    .flatMap((value) => {
      const normalized = value.trim();
      return normalized.includes(" / ") && normalized.length < 600
        ? normalized.split(/\s*\/\s*/u)
        : [normalized];
    })
    .map((value) => text(value, 2_000))
    .filter((value): value is string => Boolean(value));
  const dateIndex = lines.findIndex((value) =>
    /^(?:\w+\s+\d{1,2},\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})$/u.test(
      value,
    ),
  );
  const date = dateIndex >= 0 ? lines[dateIndex] : null;
  const withoutDate = lines.filter((_, index) => index !== dateIndex);
  const greetingIndex = withoutDate.findIndex((value) =>
    /^(?:dear|hello|hi)\b/iu.test(value),
  );
  const greeting = greetingIndex >= 0 ? withoutDate[greetingIndex] : null;
  const closingPattern =
    /^(?:sincerely|best regards|kind regards|regards|respectfully|yours sincerely|thank you)\b[,.]?$/iu;
  const closingIndex = withoutDate.findIndex((value) =>
    closingPattern.test(value),
  );
  const closing = closingIndex >= 0 ? withoutDate[closingIndex] : null;
  const signOff =
    closingIndex >= 0 ? (withoutDate[closingIndex + 1] ?? null) : null;
  const start = greetingIndex >= 0 ? greetingIndex + 1 : 0;
  const end = closingIndex >= 0 ? closingIndex : withoutDate.length;
  const paragraphs = withoutDate
    .slice(start, end)
    .filter((value) => value !== greeting && value !== signOff)
    .slice(0, 30);
  const characterCount = source.length;
  const qualityNotes: DocumentQualityNote[] = [];
  if (characterCount < 120)
    qualityNotes.push(
      note(
        "cover-letter-too-short",
        "Cover letter content",
        "The extracted cover letter is unusually short for a reliable letter assessment.",
        "HIGH",
      ),
    );
  if (!greeting)
    qualityNotes.push(
      note(
        "cover-letter-greeting-missing",
        "Cover letter greeting",
        "No greeting such as “Dear” or “Hello” was identified.",
      ),
    );
  if (!paragraphs.length)
    qualityNotes.push(
      note(
        "cover-letter-body-missing",
        "Cover letter body",
        "No paragraph-style body content was identified in the extracted text.",
        "HIGH",
      ),
    );
  if (!signOff)
    qualityNotes.push(
      note(
        "cover-letter-signoff-missing",
        "Cover letter sign-off",
        "No closing/sign-off was identified; verify that this is a complete cover letter.",
      ),
    );
  return structuredCoverLetterPreviewSchema.parse({
    kind: "cover-letter",
    date,
    greeting,
    paragraphs,
    closing,
    signOff,
    qualityNotes,
  });
}

export function buildStructuredDocumentContent(input: {
  kind: "cv" | "cover-letter";
  segments: readonly PreviewSegment[];
  applicationProfileSnapshot?: unknown;
  preferProfileSnapshot?: boolean;
}) {
  if (input.kind === "cover-letter") return coverLetterPreview(input.segments);
  const extracted = rawCvPreview(input.segments);
  if (input.preferProfileSnapshot) {
    const profile = profilePreview(input.applicationProfileSnapshot);
    const extractedHasContent = Boolean(
      extracted.name ||
      extracted.title ||
      extracted.summary ||
      extracted.experience.length ||
      extracted.skills.length ||
      extracted.education.length,
    );
    if (!extractedHasContent && profile) return profile;
  }
  return extracted;
}
