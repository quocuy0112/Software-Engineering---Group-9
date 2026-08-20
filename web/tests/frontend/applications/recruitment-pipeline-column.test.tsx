import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  ApplicationStage,
  PipelineApplicationCard,
  PipelineStageCount,
  PipelineStagePage,
} from "@/shared/contracts/applications";
import { RecruitmentPipelineColumn } from "@/frontend/features/recruiter-applications/recruitment-pipeline-column";

vi.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
}));

vi.mock(
  "@/frontend/features/recruiter-applications/recruitment-pipeline-card",
  () => ({
    RecruitmentPipelineCard: ({ card }: { card: PipelineApplicationCard }) => (
      <article>{card.candidate.displayName}</article>
    ),
  }),
);

const summary: PipelineStageCount = {
  stage: "APPLIED",
  label: "Applied",
  count: 2,
};

const card: PipelineApplicationCard = {
  applicationId: "application-1",
  candidate: { displayName: "Ada Candidate", avatarUrl: null },
  submittedAt: "2026-08-18T00:00:00.000Z",
  stage: "APPLIED",
  stageVersion: 1,
  documents: { cvAvailable: true, coverLetterAvailable: false },
  score: null,
  allowedDestinations: ["VIEWED", "WAITLISTED", "REJECTED"],
  dragDestinations: ["VIEWED", "WAITLISTED", "REJECTED"],
};

const page: PipelineStagePage = {
  stage: "APPLIED",
  items: [card],
  nextCursor: "cursor-2",
  observedAt: "2026-08-18T00:00:00.000Z",
};

const lockedStageCases: Array<[ApplicationStage, string]> = [
  ["OFFERED", "Offered"],
  ["HIRED", "Hired"],
  ["OFFER_DECLINED", "Offer Declined"],
  ["REJECTED", "Rejected"],
  ["WAITLISTED", "Waitlisted"],
];

describe("RecruitmentPipelineColumn footer", () => {
  it("keeps the card stack bounded and drives Load more from nextCursor", () => {
    const onLoadMore = vi.fn();
    const onViewAll = vi.fn();
    const { container, rerender } = render(
      <RecruitmentPipelineColumn
        jobId="job-1"
        summary={summary}
        page={page}
        loading={false}
        loadingMore={false}
        error={null}
        onLoadMore={onLoadMore}
        onRetry={vi.fn()}
        onViewAll={onViewAll}
        showViewAll
      />,
    );

    expect(container.querySelector(".card-stack")).toBeInTheDocument();
    expect(container.querySelector(".card-stack")).toHaveAttribute(
      "data-card-stack",
    );
    expect(
      screen.getByRole("button", {
        name: "Load more Applied applications",
      }),
    ).toHaveClass("load-more-btn");
    expect(screen.getByRole("button", { name: "View full list" })).toHaveClass(
      "view-all-btn",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Load more Applied applications",
      }),
    );
    expect(onLoadMore).toHaveBeenCalledWith("APPLIED");

    rerender(
      <RecruitmentPipelineColumn
        jobId="job-1"
        summary={summary}
        page={page}
        loading={false}
        loadingMore
        error={null}
        onLoadMore={onLoadMore}
        onRetry={vi.fn()}
        onViewAll={onViewAll}
        showViewAll
      />,
    );
    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
  });

  it("renders Load more from explicit hasMore without a cursor", () => {
    render(
      <RecruitmentPipelineColumn
        jobId="job-1"
        summary={summary}
        page={{ ...page, nextCursor: null, hasMore: true }}
        loading={false}
        loadingMore={false}
        error={null}
        onLoadMore={vi.fn()}
        onRetry={vi.fn()}
        showViewAll={false}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Load more Applied applications",
      }),
    ).toBeInTheDocument();
  });
});

describe("RecruitmentPipelineColumn sort controls", () => {
  it.each(lockedStageCases)(
    "renders sort and the lock for %s",
    (stage, label) => {
      const stageKey = stage as ApplicationStage;
      const stageLabel = label as PipelineStageCount["label"];
      const onToggleSortMenu = vi.fn();
      const onSortDirectionChange = vi.fn();
      const { container } = render(
        <RecruitmentPipelineColumn
          jobId="job-1"
          summary={{ stage: stageKey, label: stageLabel, count: 0 }}
          page={{
            stage: stageKey,
            items: [],
            nextCursor: null,
            observedAt: "2026-08-18T00:00:00.000Z",
          }}
          loading={false}
          loadingMore={false}
          error={null}
          onLoadMore={vi.fn()}
          onRetry={vi.fn()}
          sortDirection="none"
          sortMenuOpen
          onToggleSortMenu={onToggleSortMenu}
          onSortDirectionChange={onSortDirectionChange}
        />,
      );

      const sortButton = screen.getByRole("button", {
        name: `Sort ${label} candidates`,
      });
      expect(sortButton).toHaveClass("column-sort-btn");
      expect(container.querySelector(".lock-icon")).toBeInTheDocument();

      const menu = screen.getByRole("menu", {
        name: `${label} sort options`,
      });
      expect(menu.querySelectorAll("[data-sort]")).toHaveLength(3);

      fireEvent.click(sortButton);
      expect(onToggleSortMenu).toHaveBeenCalledWith(stage);

      fireEvent.click(menu.querySelector('[data-sort="desc"]') as HTMLElement);
      expect(onSortDirectionChange).toHaveBeenCalledWith(stage, "desc");
    },
  );
});
