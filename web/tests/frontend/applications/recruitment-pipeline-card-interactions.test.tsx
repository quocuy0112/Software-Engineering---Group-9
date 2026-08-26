import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PipelineApplicationCard } from "@/shared/contracts/applications";
import { RecruitmentPipelineCard } from "@/frontend/features/recruiter-applications/recruitment-pipeline-card";

const pointerDown = vi.fn();
const keyDown = vi.fn();

vi.mock("@dnd-kit/core", () => ({
  useDraggable: () => ({
    setNodeRef: vi.fn(),
    listeners: { onPointerDown: pointerDown, onKeyDown: keyDown },
    attributes: {
      role: "button",
      tabIndex: 0,
      "aria-pressed": false,
      "aria-roledescription": "draggable",
    },
    transform: null,
    isDragging: false,
  }),
}));

const card: PipelineApplicationCard = {
  applicationId: "application-1",
  candidate: { displayName: "Ada Candidate", avatarUrl: null },
  submittedAt: "2026-08-18T00:00:00.000Z",
  stage: "APPLIED",
  stageVersion: 1,
  documents: { cvAvailable: true, coverLetterAvailable: false },
  score: null,
  allowedDestinations: ["VIEWED", "REJECTED"],
  dragDestinations: ["VIEWED", "REJECTED"],
};

const hiredCard: PipelineApplicationCard = {
  ...card,
  applicationId: "application-hired",
  stage: "HIRED",
  stageVersion: 2,
  allowedDestinations: ["REJECTED", "WAITLISTED"],
  dragDestinations: ["REJECTED", "WAITLISTED"],
};

const rejectedCard: PipelineApplicationCard = {
  ...card,
  applicationId: "application-rejected",
  stage: "REJECTED",
  allowedDestinations: ["APPLIED", "VIEWED", "SHORTLISTED", "INTERVIEWING"],
  dragDestinations: ["APPLIED", "VIEWED", "SHORTLISTED", "INTERVIEWING"],
};

const waitlistedCard: PipelineApplicationCard = {
  ...card,
  applicationId: "application-waitlisted",
  stage: "WAITLISTED",
  allowedDestinations: [],
  dragDestinations: ["VIEWED", "SHORTLISTED", "INTERVIEWING", "REJECTED"],
};

const interviewingCard: PipelineApplicationCard = {
  ...card,
  applicationId: "application-interviewing",
  stage: "INTERVIEWING",
  allowedDestinations: ["OFFERED", "REJECTED", "WAITLISTED"],
  dragDestinations: ["OFFERED", "REJECTED", "WAITLISTED"],
};

const withdrawnCard: PipelineApplicationCard = {
  ...card,
  applicationId: "application-withdrawn",
  withdrawalOutcome: "CANDIDATE_WITHDRAWN",
};

const scoredCard: PipelineApplicationCard = {
  ...card,
  applicationId: "application-scored",
  score: {
    state: "SCORED",
    final: 72,
    aiScore: 91,
    band: { code: "MEDIUM_MATCH", label: "Review needed" },
    aiScoreBand: { code: "HIGH_MATCH", label: "Strong match" },
  },
};

describe("RecruitmentPipelineCard interactions", () => {
  beforeEach(() => {
    pointerDown.mockClear();
    keyDown.mockClear();
  });

  it("starts pointer dragging from the dedicated drag handle", () => {
    render(<RecruitmentPipelineCard card={card} jobId="job-1" />);

    fireEvent.pointerDown(
      screen.getByRole("button", {
        name: "Drag Ada Candidate to another stage",
      }),
    );

    expect(pointerDown).toHaveBeenCalledOnce();
  });
  it("starts pointer dragging from the card body", () => {
    render(<RecruitmentPipelineCard card={card} jobId="job-1" />);

    fireEvent.pointerDown(screen.getByText("Ada Candidate"));

    expect(pointerDown).toHaveBeenCalledOnce();
  });

  it("keeps Change Stage pointer and keyboard activation outside DnD listeners", () => {
    const onChangeStage = vi.fn();
    render(
      <RecruitmentPipelineCard
        card={card}
        jobId="job-1"
        onChangeStage={onChangeStage}
      />,
    );
    fireEvent.click(screen.getByText("Ada Candidate"));
    const changeStage = screen.getByRole("button", { name: "Change Stage" });

    fireEvent.pointerDown(changeStage);
    fireEvent.click(changeStage);
    fireEvent.keyDown(changeStage, { key: "Enter" });

    expect(onChangeStage).toHaveBeenCalledOnce();
    expect(pointerDown).not.toHaveBeenCalled();
    expect(keyDown).not.toHaveBeenCalled();
  });

  it("keeps a dedicated keyboard drag handle", () => {
    render(<RecruitmentPipelineCard card={card} jobId="job-1" />);
    const handle = screen.getByRole("button", {
      name: "Drag Ada Candidate to another stage",
    });

    fireEvent.keyDown(handle, { key: "Enter" });

    expect(keyDown).toHaveBeenCalledOnce();
  });

  it("keeps hired cards read-only even when stale destinations are present", () => {
    const onChangeStage = vi.fn();
    render(
      <RecruitmentPipelineCard
        card={hiredCard}
        jobId="job-1"
        onChangeStage={onChangeStage}
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: "Drag Ada Candidate to another stage",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Change Stage" }),
    ).not.toBeInTheDocument();

    const pipelineCard = screen.getByText("Ada Candidate").closest("article");
    expect(pipelineCard).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByText("Ada Candidate"));
    expect(pipelineCard).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerDown(screen.getByText("Ada Candidate"));

    expect(pointerDown).not.toHaveBeenCalled();
    expect(onChangeStage).not.toHaveBeenCalled();
  });

  it("shows withdrawn cards as read-only with a dedicated status", () => {
    const onChangeStage = vi.fn();
    render(
      <RecruitmentPipelineCard
        card={withdrawnCard}
        jobId="job-1"
        onChangeStage={onChangeStage}
      />,
    );

    expect(screen.getByText("WITHDRAWN")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Drag Ada Candidate to another stage",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Change Stage" }),
    ).not.toBeInTheDocument();

    fireEvent.pointerDown(screen.getByText("Ada Candidate"));

    expect(pointerDown).not.toHaveBeenCalled();
    expect(onChangeStage).not.toHaveBeenCalled();
  });

  it("keeps Rejected cards read-only even when stale destinations are present", () => {
    render(<RecruitmentPipelineCard card={rejectedCard} jobId="job-1" />);

    expect(
      screen.queryByRole("button", {
        name: "Drag Ada Candidate to another stage",
      }),
    ).not.toBeInTheDocument();
    fireEvent.pointerDown(screen.getByText("Ada Candidate"));

    expect(pointerDown).not.toHaveBeenCalled();
  });

  it.each([
    ["OFFERED", "offered"],
    ["HIRED", "hired"],
    ["OFFER_DECLINED", "offer-declined"],
    ["REJECTED", "rejected"],
    ["WAITLISTED", "waitlisted"],
  ] as const)(
    "supports click-to-view actions for %s cards",
    (stage, applicationId) => {
      const stageCard: PipelineApplicationCard = {
        ...card,
        applicationId: `application-${applicationId}`,
        stage,
        allowedDestinations: [],
        dragDestinations: [],
      };

      render(<RecruitmentPipelineCard card={stageCard} jobId="job-1" />);

      const pipelineCard = screen.getByText("Ada Candidate").closest("article");
      expect(pipelineCard).toHaveClass("is-collapsible");
      expect(pipelineCard).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(screen.getByText("Ada Candidate"));

      expect(pipelineCard).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText("Click to collapse")).toBeInTheDocument();
    },
  );

  it("allows Waitlisted cards to drag to their server-projected destinations", () => {
    render(<RecruitmentPipelineCard card={waitlistedCard} jobId="job-1" />);

    expect(
      screen.getByRole("button", {
        name: "Drag Ada Candidate to another stage",
      }),
    ).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByText("Ada Candidate"));

    expect(pointerDown).toHaveBeenCalledOnce();
  });

  it("shows Send offer for Interviewing cards and submits the Offered target", () => {
    const onChangeStage = vi.fn();
    render(
      <RecruitmentPipelineCard
        card={interviewingCard}
        jobId="job-1"
        onChangeStage={onChangeStage}
      />,
    );

    fireEvent.click(screen.getByText("Ada Candidate"));
    fireEvent.click(screen.getByRole("button", { name: "Send offer" }));

    expect(onChangeStage).toHaveBeenCalledWith(interviewingCard, "OFFERED");
  });

  it("displays the final score and final-score tier badge", () => {
    render(<RecruitmentPipelineCard card={scoredCard} jobId="job-1" />);

    expect(
      screen.getByRole("progressbar", {
        name: "Final score 72 percent for Ada Candidate",
      }),
    ).toHaveAttribute("aria-valuenow", "72");
    expect(screen.getByText("72%")).toBeVisible();
    expect(screen.getByText("Review needed")).toBeVisible();
    expect(screen.queryByText("Strong match")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("progressbar", {
        name: "AI Smart Match score 91 percent for Ada Candidate",
      }),
    ).not.toBeInTheDocument();
  });

  it("opens the AI assessment from the Kanban card", () => {
    const onViewAssessment = vi.fn();
    render(
      <RecruitmentPipelineCard
        card={scoredCard}
        jobId="job-1"
        onViewAssessment={onViewAssessment}
      />,
    );

    fireEvent.click(screen.getByText("Ada Candidate"));

    fireEvent.click(screen.getByRole("button", { name: "View AI assessment" }));

    expect(onViewAssessment).toHaveBeenCalledOnce();
    expect(onViewAssessment).toHaveBeenCalledWith(scoredCard);
  });
});
