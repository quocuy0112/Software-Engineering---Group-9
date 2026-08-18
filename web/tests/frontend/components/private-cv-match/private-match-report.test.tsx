import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { PrivateMatchReady } from "@/frontend/features/private-cv-match/components/private-match-ready";
import { PrivateMatchReport } from "@/frontend/features/private-cv-match/components/private-match-report";
import type {
  FullPrivateReport,
  LimitedPrivateReport,
  PrivateAutomaticComponent,
} from "@/shared/contracts/private-cv-match";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock(
  "@/frontend/features/private-cv-match/components/private-match-delete-control",
  () => ({
    PrivateMatchDeleteControl: () => (
      <button type="button">Delete this preview</button>
    ),
  }),
);

const base = {
  checkId: "check-1",
  createdAt: "2026-08-16T00:00:00.000Z",
  expiresAt: "2027-08-16T00:00:00.000Z",
  provenance: {
    cvVersionId: "cv-1",
    cvVersion: 2,
    jdVersion: 4,
    scoringConfigVersion: "HS-60/40-v1",
    aiProvider: "openai",
    aiModel: "gpt-5.4-mini-2026-03-17",
    promptVersion: "private-match-v1",
    inputPolicyVersion: "cv-safe-v1",
  },
  job: {
    jobId: "job-1",
    slug: "senior-platform-engineer",
    title: "Senior Platform Engineer",
    company: "SmartHire",
    location: "Remote",
    employmentType: "FULL_TIME",
    workArrangement: "REMOTE",
    requiredExperienceYears: 4,
    requirements: ["Kafka", "TypeScript"] as string[],
    jdVersion: 4,
    jdUpdatedAt: "2026-08-15T00:00:00.000Z",
  },
  cv: {
    versionId: "cv-1",
    version: 2,
    displayName: "Platform CV",
    fileName: "platform-cv.pdf",
    mimeType: "application/pdf" as const,
    byteSize: 240_000,
    pageCount: 3,
    parseStatus: "READY" as const,
    confirmedAt: "2026-08-16T00:00:00.000Z",
  },
};

const automatic: PrivateAutomaticComponent = {
  score: 92,
  weight: 0.6,
  weightedContribution: 55.2,
  evidenceCoverage: 82,
  evidenceConfidence: 88,
  matchedRequirements: [
    { id: "typescript", label: "TypeScript", kind: "REQUIRED", matched: true },
    { id: "kafka", label: "Kafka", kind: "REQUIRED", matched: false },
    {
      id: "observability",
      label: "Observability",
      kind: "PREFERRED",
      matched: true,
    },
  ],
  gaps: [
    {
      code: "kafka",
      title: "Kafka — missing",
      description: "Add or verify direct Kafka evidence before applying.",
      kind: "REQUIRED",
    },
  ],
  requiredExperience: 4,
  detectedExperience: 5,
  evidence: [
    {
      type: "PROJECT",
      quote: "Built a platform service used by multiple teams.",
      criterion: "Platform delivery",
      location: "Projects · Page 1",
      confidence: 0.92,
    },
    {
      type: "IMPACT",
      quote: "Reduced deployment time by 40%.",
      criterion: "Operational impact",
      location: "Experience · Page 2",
      confidence: 0.86,
    },
  ],
  parserProvenance: {
    parserVersion: "parser-v1",
    cvStatus: "READY",
    jdStatus: "READY",
  },
  mayBeIncomplete: false,
};

const fullReport: FullPrivateReport = {
  ...base,
  view: "FULL_REPORT",
  state: "READY",
  mode: "HYBRID",
  hybridScore: 86.4,
  matchBand: "HIGH_MATCH",
  automatic,
  aiEvaluation: {
    score: 78,
    weight: 0.4,
    weightedContribution: 31.2,
    summary: "Your strongest evidence is in platform delivery.",
    strengths: [],
    mainGap: "Verify Kafka experience.",
    actions: ["Kafka: Add a concrete project example."],
    evidenceConfidence: 80,
    evidenceLevel: "HIGH",
    provider: "openai",
    model: "gpt-5.4-mini-2026-03-17",
    promptVersion: "private-match-v1",
    policyVersion: "policy-v1",
    durationMs: 1_200,
    completedAt: "2026-08-16T00:00:12.000Z",
  },
  evidenceConfidence: 84,
  summary: "You have strong evidence for most of the core requirements.",
  actions: ["Kafka: Add a concrete project example."],
  canApply: true,
  completedAt: "2026-08-16T00:00:12.000Z",
  retryInProgress: false,
};

const limitedReport: LimitedPrivateReport = {
  ...base,
  view: "LIMITED_REPORT",
  state: "LIMITED",
  mode: "LIMITED",
  automatic,
  aiEvaluation: null,
  hybridScore: null,
  matchBand: null,
  canRetryAi: true,
  canApply: true,
  retryInProgress: false,
  completedAt: "2026-08-16T00:00:12.000Z",
  failureCode: "AI_UNAVAILABLE",
};

describe("PrivateMatchReport", () => {
  it("uses the shared completion status and selected-job display mapping", () => {
    render(<PrivateMatchReady report={fullReport} onOpen={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveClass(
      "private-match-status-card",
      "private-match-status-card--completed",
    );
    expect(screen.getByText("Full-time")).toBeVisible();
    expect(screen.getByText("4+ years")).toBeVisible();
    expect(screen.queryByText("FULL_TIME")).not.toBeInTheDocument();
    expect(screen.getByText("Private and fair by design")).toBeVisible();
  });

  it("uses the caution treatment for a low match band", () => {
    const lowReport: FullPrivateReport = {
      ...fullReport,
      hybridScore: 42.1,
      matchBand: "LOW_MATCH",
    };

    render(<PrivateMatchReady report={lowReport} onOpen={vi.fn()} />);

    expect(
      document.querySelector(
        ".private-match-ready-banner.is-caution .private-match-hero-icon",
      ),
    ).toBeTruthy();
    expect(screen.getByText("May need more evidence")).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Your CV may need more evidence for this role",
      }),
    ).toBeVisible();
  });

  it("keeps normal header content in three non-overlapping boxes and stacks evidence", () => {
    render(<PrivateMatchReport checkId="check-1" report={fullReport} />);

    expect(screen.getByText("Independent candidate preview")).toBeVisible();
    expect(
      document.querySelector(
        ".private-match-report-score .private-match-badge",
      ),
    ).toBeNull();
    expect(
      document.querySelectorAll(".private-match-report-header > *"),
    ).toHaveLength(3);
    expect(
      document.querySelectorAll(".private-match-report-summary > p"),
    ).toHaveLength(1);
    expect(
      document.querySelectorAll(".private-match-metric-card"),
    ).toHaveLength(4);
    expect(
      document.querySelectorAll(".private-match-evidence-list > li"),
    ).toHaveLength(2);
    const confidenceCard = document.querySelector(
      ".private-match-confidence-card",
    );
    expect(confidenceCard?.children[0]?.tagName).toBe("H3");
    expect(confidenceCard?.children[1]?.tagName).toBe("STRONG");
    expect(confidenceCard?.children[2]).toHaveClass("private-match-progress");
    expect(confidenceCard?.children[3]?.tagName).toBe("P");
    expect(
      Array.from(
        document.querySelectorAll(".private-match-metric-card p"),
        (caption) => caption.textContent,
      ),
    ).toEqual([
      "Weighted contribution: 55.2",
      "Weighted contribution: 31.2",
      "Clear evidence for 2 of 3 checks",
      "Confidence is not part of the score",
    ]);
    expect(screen.getByText(/92 .* 60%.*78 .* 40%/u)).toBeVisible();
    expect(screen.getByText(/JD v4.*CV v2.*HS-60\/40-v1/u)).toBeVisible();
    expect(screen.getByText("Project")).toBeVisible();
    expect(screen.getByText("Impact")).toBeVisible();
    expect(screen.getByText("Kafka", { selector: "strong" })).toBeVisible();
    expect(screen.getByText("Add a concrete project example.")).toBeVisible();
  });

  it("allows a completed hybrid report to start a fresh AI evaluation", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <PrivateMatchReport
        checkId="check-1"
        report={fullReport}
        onRetry={onRetry}
      />,
    );

    const retryButton = screen.getByRole("button", {
      name: "Re-run AI evaluation",
    });
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(
      <PrivateMatchReport
        checkId="check-1"
        report={{ ...fullReport, retryInProgress: true }}
        onRetry={onRetry}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Re-running..." }),
    ).toBeDisabled();
  });

  it("renders limited mode as deterministic-only throughout the report", () => {
    render(
      <PrivateMatchReport
        checkId="check-1"
        report={limitedReport}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("DETERMINISTIC MATCH")).toBeVisible();
    expect(screen.getByText("Reduced-capability preview")).toBeVisible();
    expect(screen.getByText("AI evaluation unavailable")).toBeVisible();
    expect(
      document.querySelector(
        ".private-match-report-header.is-limited .private-match-report-score",
      ),
    ).toBeTruthy();
    expect(
      document.querySelector(".private-match-calc-card.is-limited"),
    ).toBeTruthy();
    expect(
      document.querySelector(
        ".private-match-metric-card.is-unavailable > strong",
      ),
    ).toHaveTextContent("—");
    expect(screen.getByText("Hybrid score unavailable")).toBeVisible();
    expect(screen.getByText("Final score: not calculated")).toBeVisible();
    expect(screen.getByRole("button", { name: /Retry AI/u })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Delete this preview" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Sensitive personal attributes are excluded."),
    ).toBeVisible();
    expect(
      Array.from(
        document.querySelectorAll(".private-match-metric-card p"),
        (caption) => caption.textContent,
      ),
    ).toEqual([
      "Available deterministic component",
      "AI contribution unavailable",
      "Clear evidence for 2 of 3 checks",
      "Confidence is not part of the score",
    ]);
    expect(screen.queryByText("Strong match")).not.toBeInTheDocument();
  });

  it("keeps the evidence section intact when no bounded quotes are available", () => {
    const emptyReport: FullPrivateReport = {
      ...fullReport,
      automatic: { ...fullReport.automatic, evidence: [] },
    };

    render(<PrivateMatchReport checkId="check-1" report={emptyReport} />);

    const evidenceHeading = screen.getByRole("heading", {
      name: "Evidence found in your CV",
    });
    expect(evidenceHeading).toBeVisible();
    expect(evidenceHeading.querySelector("svg")).not.toBeNull();
    expect(
      screen.getByText("No bounded evidence quotes are available."),
    ).toBeVisible();
  });
});
