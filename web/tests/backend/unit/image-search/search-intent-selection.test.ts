import { describe, expect, it } from "vitest";

import { DeterministicSearchIntentInterpreter } from "@/backend/image-search/interpretation/deterministic";
import { SearchIntentSelectionPolicy } from "@/backend/image-search/interpretation/selection-policy";

const text =
  "Vị trí: Senior TypeScript Engineer\nĐịa điểm: Hồ Chí Minh\nRemote full-time\nLương: 30 triệu";

describe("search-intent-selection-v1", () => {
  it("derives only evidence-backed Feature 003 criteria", async () => {
    const proposals =
      await new DeterministicSearchIntentInterpreter().interpret({
        text,
        language: "BILINGUAL",
        purposeVersion: "job-image-search-purpose-v1",
        inputVersion: "search-ocr-text-v1",
        instructionVersion: "job-search-intent-v1",
        schemaVersion: "job-search-intent-v1",
        allowedFields: [
          "q",
          "location",
          "employmentType",
          "experienceLevel",
          "workArrangement",
          "skills",
          "salaryMin",
          "salaryMax",
          "salaryCurrency",
          "salaryPeriod",
          "postedWithinDays",
        ],
        deadline: new Date(Date.now() + 1_000),
        signal: new AbortController().signal,
      });
    const result = new SearchIntentSelectionPolicy().validateAndSelect({
      ocrText: text,
      language: "BILINGUAL",
      proposals,
    });
    expect(result.proposals.map((item) => item.field)).toEqual(
      expect.arrayContaining([
        "q",
        "location",
        "employmentType",
        "experienceLevel",
        "workArrangement",
        "skills",
        "salaryMin",
      ]),
    );
    expect(result.proposals.every((item) => item.evidence[0]?.text)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/jobId|ranking|candidate/iu);
  });

  it("rejects invalid evidence/private fields and preserves manual scalar criteria", () => {
    const policy = new SearchIntentSelectionPolicy();
    const intent = policy.validateAndSelect({
      ocrText: "Remote",
      language: "EN",
      proposals: [
        {
          id: "bad-evidence",
          field: "q",
          stringValue: "Engineer",
          numberValue: null,
          stringValues: [],
          confidence: 0.99,
          basis: "EXPLICIT",
          evidence: [{ startCodePoint: 100, endCodePoint: 108 }],
        },
        {
          id: "remote",
          field: "workArrangement",
          stringValue: null,
          numberValue: null,
          stringValues: ["REMOTE"],
          confidence: 0.95,
          basis: "NORMALIZED",
          evidence: [{ startCodePoint: 0, endCodePoint: 6 }],
        },
      ],
    });
    expect(intent.proposals).toHaveLength(1);
    expect(intent.warnings).toContain("UNVERIFIED_EVIDENCE_REMOVED");
    const delivered = policy.mergeForDelivery({
      intent: {
        ...intent,
        proposals: [
          ...intent.proposals,
          {
            id: "q-proposal",
            field: "q",
            stringValue: "Engineer",
            numberValue: null,
            stringValues: [],
            confidence: 0.95,
            basis: "EXPLICIT",
            evidence: [{ startCodePoint: 0, endCodePoint: 6, text: "Remote" }],
            selected: true,
            selectionReason: "AUTO_EXPLICIT",
          },
        ],
      },
      currentCriteria: {
        q: "Designer",
        location: "",
        employmentType: [],
        experienceLevel: [],
        workArrangement: ["REMOTE"],
        skills: [],
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: "VND",
        salaryPeriod: "MONTH",
        postedWithinDays: null,
        sort: "NEWEST",
      },
    });
    expect(delivered.proposals).toHaveLength(1);
    expect(delivered.proposals[0]).toMatchObject({
      field: "q",
      selected: false,
      selectionReason: "MANUAL_VALUE_CONFLICT",
    });
  });
});
