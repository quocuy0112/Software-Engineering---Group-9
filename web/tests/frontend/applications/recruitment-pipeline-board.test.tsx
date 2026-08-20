import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecruitmentPipelineBoard } from "@/frontend/features/recruiter-applications/recruitment-pipeline-board";

vi.mock("@/frontend/features/recruiter-applications/use-recruitment-pipeline", () => ({
  useRecruitmentPipeline: () => ({ metadata: { job: { jobId: "job-1", title: "Engineer", status: "ACTIVE" }, permissions: { role: "OWNER", canView: true, canMoveStages: true, canReject: true, canRecordOfferDeclined: true, canConfirmHired: true }, stages: ["Applied", "Viewed", "Shortlisted", "Interviewing", "Offered", "Hired", "Offer Declined", "Rejected", "Waitlisted"].map((label, index) => ({ stage: ["APPLIED", "VIEWED", "SHORTLISTED", "INTERVIEWING", "OFFERED", "HIRED", "OFFER_DECLINED", "REJECTED", "WAITLISTED"][index], label, count: 0 })), observedAt: new Date().toISOString() }, columns: {}, loading: false, error: null, loadStage: vi.fn(), loadMore: vi.fn(), retry: vi.fn() }),
}));

describe("RecruitmentPipelineBoard", () => {
  it("renders all nine named columns and read-only status", () => {
    render(<RecruitmentPipelineBoard jobId="job-1" />);
    const columns = screen.getAllByRole("region");
    expect(columns).toHaveLength(9);
    expect(columns.map((column) => within(column).getByRole("heading").textContent)).toEqual([
      "Applied",
      "Viewed",
      "Shortlisted",
      "Interviewing",
      "Offered",
      "Hired",
      "Offer Declined",
      "Rejected",
      "Waitlisted",
    ]);
    expect(screen.getByText(/read.only/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /offer declined/i })).toBeInTheDocument();
  });
});
