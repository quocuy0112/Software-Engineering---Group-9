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
};

describe("RecruitmentPipelineCard interactions", () => {
  beforeEach(() => {
    pointerDown.mockClear();
    keyDown.mockClear();
  });

  it("starts pointer dragging from the non-interactive card body", () => {
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

    expect(handle).toHaveClass("sr-only");

    fireEvent.keyDown(handle, { key: "Enter" });

    expect(keyDown).toHaveBeenCalledOnce();
  });
});
