export type CvPreflightIssue = Readonly<{
  bucket: "input_limitation" | "extraction_uncertainty";
  description: string;
  evidenceQuote: string | null;
}>;

type CvPreflightInput = Readonly<{
  cvText: string;
  jobTitle?: string;
  requiredSkills?: readonly string[];
}>;

const MAX_QUOTE_LENGTH = 240;

function quote(value: string): string {
  return value.replace(/\s+/gu, " ").trim().slice(0, MAX_QUOTE_LENGTH);
}

function issueKey(issue: CvPreflightIssue): string {
  return `${issue.bucket}|${issue.description.toLocaleLowerCase("en-US")}`;
}

function addIssue(
  issues: CvPreflightIssue[],
  issue: CvPreflightIssue,
) {
  if (!issues.some((candidate) => issueKey(candidate) === issueKey(issue))) issues.push(issue);
}

/**
 * Validate the raw CV payload before it crosses the AI boundary. This is
 * intentionally conservative: it never changes the automatic score, but it
 * makes parser/redaction anomalies visible and lets the AI result degrade to
 * the explicit low-data-quality state instead of presenting a normal-looking
 * assessment based on corrupted input.
 */
export function inspectCvForAiPreflight(input: CvPreflightInput): CvPreflightIssue[] {
  const text = input.cvText.trim();
  const issues: CvPreflightIssue[] = [];
  if (!text) {
    return [{
      bucket: "input_limitation",
      description: "The application CV contains no extractable text, so a reliable AI assessment is not possible.",
      evidenceQuote: null,
    }];
  }

  const dateFieldPattern = /(?:start(?:_|\s*)date|end(?:_|\s*)date|employment\s+dates?)\s*["']?\s*[:=]\s*["']?([^,"'}\n]{1,100})/iu;
  const dateField = text.match(dateFieldPattern);
  if (dateField && /redact|phone|email|hidden|mask|\[[^\]]+\]/iu.test(dateField[1] ?? "")) {
    addIssue(issues, {
      bucket: "input_limitation",
      description: "Employment date fields contain a redaction or placeholder value; total experience cannot be verified.",
      evidenceQuote: quote(dateField[0]),
    });
  }

  const impossibleDate = text.match(/\b(?:0\d{3}|1[0-8]\d{2}|20(?:2[7-9]|[3-9]\d)|21\d{2})-\d{2}-\d{2}\b/iu);
  if (impossibleDate) {
    addIssue(issues, {
      bucket: "extraction_uncertainty",
      description: "A date-like value falls outside the plausible CV date range and should be rechecked before scoring.",
      evidenceQuote: quote(impossibleDate[0]),
    });
  }

  // A repeated structured record is a common symptom of accidentally joining
  // two parser results. Ignore short repeated headings; only flag a repeated
  // title/company pair, which is much less likely to be normal page layout.
  const structuredRecords = [...text.matchAll(/(?:title|jobTitle)\s*[:=]\s*["']([^"']{3,120})["'][\s\S]{0,500}?(?:company|employer)\s*[:=]\s*["']([^"']{2,120})["']/giu)]
    .map((match) => `${match[1]?.trim().toLocaleLowerCase("en-US")}|${match[2]?.trim().toLocaleLowerCase("en-US")}`);
  const repeatedRecord = structuredRecords.find((record, index) => structuredRecords.indexOf(record) !== index);
  if (repeatedRecord) {
    addIssue(issues, {
      bucket: "extraction_uncertainty",
      description: "The parsed CV contains a repeated experience record; verify that records from another import were not merged.",
      evidenceQuote: quote(repeatedRecord.replace("|", " — ")),
    });
  }

  const domains = [
    {
      label: "marketing",
      terms: ["digital marketing", "seo", "sem", "content marketing", "social media", "adobe photoshop"],
    },
    {
      label: "software and IT",
      terms: ["react", "react native", "typescript", "javascript", "rest api", "python", "sql", "it operations", "software development"],
    },
    {
      label: "operations and logistics",
      terms: ["warehouse", "logistics", "inventory", "supply chain", "transport"],
    },
  ].filter((domain) => domain.terms.filter((term) => text.toLocaleLowerCase("en-US").includes(term)).length >= 2);
  if (domains.length >= 2) {
    const job = `${input.jobTitle ?? ""} ${(input.requiredSkills ?? []).join(" ")}`.toLocaleLowerCase("en-US");
    const domainEvidence = domains.map((domain) => domain.label).join(" + ");
    // This is an uncertainty flag, not a rejection. A genuine career change
    // can span domains; the recruiter should see the warning and confirm the
    // source document when the mix is unexpectedly broad for this posting.
    addIssue(issues, {
      bucket: "extraction_uncertainty",
      description: `The CV contains unrelated skill domains (${domainEvidence}); verify that the candidate record was not cross-contaminated.`,
      evidenceQuote: quote(text.slice(0, 600)),
    });
    if (!job) {
      addIssue(issues, {
        bucket: "extraction_uncertainty",
        description: "The job context is missing, so the relevance of the mixed skill domains cannot be checked automatically.",
        evidenceQuote: null,
      });
    }
  }

  return issues;
}
