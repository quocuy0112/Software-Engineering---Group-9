import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  pipelineApplicationStages,
  pipelineStageLabels,
  type ApplicationStage,
  type PipelineApplicationCard,
} from "@/shared/contracts/applications";
import { RecruitmentPipelineBoard } from "@/frontend/features/recruiter-applications/recruitment-pipeline-board";

const move = vi.fn().mockResolvedValue(undefined);

const ordinaryCard: PipelineApplicationCard = {
  applicationId: "ordinary-application",
  candidate: { displayName: "Ordinary Candidate", avatarUrl: null },
  submittedAt: "2026-08-18T00:00:00.000Z",
  stage: "APPLIED",
  stageVersion: 1,
  documents: { cvAvailable: false, coverLetterAvailable: false },
  score: null,
  allowedDestinations: ["VIEWED"],
};

const guardedCard: PipelineApplicationCard = {
  ...ordinaryCard,
  applicationId: "guarded-application",
  candidate: { displayName: "Guarded Candidate", avatarUrl: null },
  stage: "SHORTLISTED",
  allowedDestinations: ["REJECTED"],
};

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({
    children,
    onDragStart,
    onDragEnd,
  }: {
    children: ReactNode;
    onDragStart: (event: { active: { id: string } }) => void;
    onDragEnd: (event: {
      over: { data: { current: { stage: ApplicationStage } } };
    }) => void;
  }) => (
    <>
      <button
        type="button"
        data-testid="start-ordinary-drag"
        onClick={() => onDragStart({ active: { id: ordinaryCard.applicationId } })}
      >
        Start ordinary drag
      </button>
      <button
        type="button"
        data-testid="start-guarded-drag"
        onClick={() => onDragStart({ active: { id: guardedCard.applicationId } })}
      >
        Start guarded drag
      </button>
      <button
        type="button"
        data-testid="drop-viewed"
        onClick={() =>
          onDragEnd({ over: { data: { current: { stage: "VIEWED" } } } })
        }
      >
        Drop in Viewed
      </button>
      <button
        type="button"
        data-testid="drop-rejected"
        onClick={() =>
          onDragEnd({ over: { data: { current: { stage: "REJECTED" } } } })
        }
      >
        Drop in Rejected
      </button>
      {children}
    </>
  ),
  DragOverlay: ({ children }: { children: ReactNode }) => <>{children}</>,
  KeyboardSensor: class KeyboardSensor {},
  PointerSensor: class PointerSensor {},
  useDraggable: () => ({
    setNodeRef: vi.fn(),
    listeners: {},
    attributes: {},
    transform: null,
    isDragging: false,
  }),
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock("@/frontend/features/recruiter-applications/use-recruitment-pipeline", () => ({
  useRecruitmentPipeline: () => ({
    metadata: {
      job: { jobId: "job-1", title: "Engineer", status: "ACTIVE" },
      permissions: {
        role: "RECRUITER",
        canView: true,
        canMoveStages: true,
        canReject: true,
        canRecordOfferDeclined: true,
        canConfirmHired: true,
      },
      stages: pipelineApplicationStages.map((stage) => ({
        stage,
        label: pipelineStageLabels[stage],
        count: stage === "APPLIED" || stage === "SHORTLISTED" ? 1 : 0,
      })),
      observedAt: "2026-08-18T00:00:00.000Z",
    },
    columns: {
      APPLIED: {
        page: {
          stage: "APPLIED",
          items: [ordinaryCard],
          nextCursor: null,
          observedAt: "2026-08-18T00:00:00.000Z",
        },
        loading: false,
        loadingMore: false,
        error: null,
      },
      SHORTLISTED: {
        page: {
          stage: "SHORTLISTED",
          items: [guardedCard],
          nextCursor: null,
          observedAt: "2026-08-18T00:00:00.000Z",
        },
        loading: false,
        loadingMore: false,
        error: null,
      },
    },
    loading: false,
    error: null,
    announcement: "",
    canRetryStageMove: false,
    loadStage: vi.fn(),
    loadMore: vi.fn(),
    retry: vi.fn(),
    retryStageMove: vi.fn(),
    move,
  }),
}));

describe("RecruitmentPipelineBoard drag transitions", () => {
  beforeEach(() => move.mockClear());

  it("persists an ordinary valid drop without opening a confirmation dialog", async () => {
    render(<RecruitmentPipelineBoard jobId="job-1" />);

    fireEvent.click(screen.getByTestId("start-ordinary-drag"));
    fireEvent.click(screen.getByTestId("drop-viewed"));

    await waitFor(() => expect(move).toHaveBeenCalledWith(ordinaryCard, "VIEWED", {}));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("routes a guarded drop through the shared required-input dialog", async () => {
    render(<RecruitmentPipelineBoard jobId="job-1" />);

    fireEvent.click(screen.getByTestId("start-guarded-drag"));
    fireEvent.click(screen.getByTestId("drop-rejected"));

    const dialog = screen.getByRole("dialog", {
      name: "Change Stage for Guarded Candidate",
    });
    expect(dialog).toBeVisible();
    const confirm = screen.getByRole("button", { name: "Confirm rejection" });
    expect(screen.getByLabelText("Destination stage")).toHaveValue("REJECTED");
    expect(confirm).toBeDisabled();
    expect(move).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Rejection reason"), {
      target: { value: "POSITION_FILLED" },
    });
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(move).toHaveBeenCalledWith(guardedCard, "REJECTED", {
        confirmed: true,
        reasonCode: "POSITION_FILLED",
        internalNote: undefined,
      }),
    );
  });
});
