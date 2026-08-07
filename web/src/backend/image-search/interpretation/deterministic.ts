import "server-only";

import type {
  RawIntentProposal,
  SearchIntentInterpretRequest,
  SearchIntentInterpreter,
} from "./search-intent-interpreter";

function proposal(
  match: RegExpExecArray,
  value: Omit<RawIntentProposal, "id" | "evidenceText">,
  index: number,
): RawIntentProposal {
  const evidence = match[0];
  return {
    id: `det-${value.field}-${index}`,
    ...value,
    evidenceText: [evidence],
  };
}

const enumRules = [
  {
    field: "workArrangement" as const,
    values: [
      ["REMOTE", /\b(?:remote|từ xa|làm việc từ xa)\b/giu],
      ["HYBRID", /\b(?:hybrid|kết hợp)\b/giu],
      ["ONSITE", /\b(?:on[ -]?site|tại văn phòng)\b/giu],
    ] as const,
  },
  {
    field: "employmentType" as const,
    values: [
      ["FULL_TIME", /\b(?:full[ -]?time|toàn thời gian)\b/giu],
      ["PART_TIME", /\b(?:part[ -]?time|bán thời gian)\b/giu],
      ["CONTRACT", /\b(?:contract|hợp đồng)\b/giu],
      ["INTERNSHIP", /\b(?:internship|intern|thực tập)\b/giu],
      ["TEMPORARY", /\b(?:temporary|thời vụ)\b/giu],
    ] as const,
  },
  {
    field: "experienceLevel" as const,
    values: [
      ["ENTRY", /\b(?:entry level|fresher|mới tốt nghiệp)\b/giu],
      ["JUNIOR", /\bjunior\b/giu],
      ["MID", /\b(?:mid(?:dle)?|intermediate)\b/giu],
      ["SENIOR", /\b(?:senior|chuyên viên cao cấp)\b/giu],
      ["LEAD", /\b(?:lead|team leader|trưởng nhóm)\b/giu],
      ["MANAGER", /\b(?:manager|quản lý)\b/giu],
    ] as const,
  },
] as const;

const skillNames = [
  "TypeScript",
  "JavaScript",
  "Java",
  "Python",
  "React",
  "Next.js",
  "Node.js",
  "PostgreSQL",
  "AWS",
  "Docker",
  "Kubernetes",
  "Figma",
] as const;

export class DeterministicSearchIntentInterpreter implements SearchIntentInterpreter {
  readonly interpreterClass = "DETERMINISTIC_INTERNAL" as const;

  async interpret(input: SearchIntentInterpretRequest) {
    if (input.signal.aborted || input.deadline <= new Date())
      throw new Error("INTERPRETER_UNAVAILABLE");
    const proposals: RawIntentProposal[] = [];
    for (const rule of enumRules) {
      for (const [normalized, pattern] of rule.values) {
        const match = new RegExp(pattern.source, pattern.flags).exec(
          input.text,
        );
        if (!match) continue;
        proposals.push(
          proposal(
            match,
            {
              field: rule.field,
              stringValue: null,
              numberValue: null,
              stringValues: [normalized],
              confidence: 0.98,
              basis: "NORMALIZED",
            },
            proposals.length,
          ),
        );
      }
    }
    for (const skill of skillNames) {
      const match = new RegExp(
        `\\b${skill.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\b`,
        "iu",
      ).exec(input.text);
      if (!match) continue;
      proposals.push(
        proposal(
          match,
          {
            field: "skills",
            stringValue: null,
            numberValue: null,
            stringValues: [skill],
            confidence: 0.96,
            basis: "EXPLICIT",
          },
          proposals.length,
        ),
      );
    }
    const labeled = [
      {
        field: "location" as const,
        pattern:
          /(?:location|địa điểm|nơi làm việc)\s*[:-]\s*([^\n|]{2,160})/iu,
      },
      {
        field: "q" as const,
        pattern:
          /(?:position|job title|vị trí|tuyển dụng)\s*[:-]\s*([^\n|]{2,200})/iu,
      },
    ];
    for (const rule of labeled) {
      const match = rule.pattern.exec(input.text);
      const value = match?.[1]?.trim();
      if (!match || !value) continue;
      proposals.push(
        proposal(
          match,
          {
            field: rule.field,
            stringValue: value,
            numberValue: null,
            stringValues: [],
            confidence: 0.97,
            basis: "EXPLICIT",
          },
          proposals.length,
        ),
      );
    }
    const salary =
      /(?:salary|lương)\s*[:-]?\s*(\d+(?:[.,]\d+)?)\s*(triệu|million|m)\b/iu.exec(
        input.text,
      );
    if (salary) {
      const amount = Number((salary[1] ?? "0").replace(",", ".")) * 1_000_000;
      proposals.push(
        proposal(
          salary,
          {
            field: "salaryMin",
            stringValue: null,
            numberValue: amount,
            stringValues: [],
            confidence: 0.94,
            basis: "NORMALIZED",
          },
          proposals.length,
        ),
      );
      proposals.push(
        proposal(
          salary,
          {
            field: "salaryCurrency",
            stringValue: "VND",
            numberValue: null,
            stringValues: [],
            confidence: 0.94,
            basis: "NORMALIZED",
          },
          proposals.length,
        ),
      );
    }
    return proposals.slice(0, 20);
  }
}
