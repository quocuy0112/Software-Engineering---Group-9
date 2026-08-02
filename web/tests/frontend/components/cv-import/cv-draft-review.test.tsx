import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CvDraftReview } from "@/frontend/features/cv-import/components/cv-draft-review";
import {
  cvConfirmationReceiptFixture,
  cvDraftReviewFixture,
} from "../../../fixtures/cv-draft-review";

afterEach(() => vi.unstubAllGlobals());

describe("CV draft review", () => {
  it("compares, edits, exposes evidence, and keeps bulk choices independent", () => {
    const addListener = vi.spyOn(window, "addEventListener");
    render(
      <CvDraftReview initial={cvDraftReviewFixture} csrfProof="csrf_test" />,
    );
    expect(screen.getByText("Current engineer")).toBeVisible();
    expect(screen.getByDisplayValue("Platform engineer")).toBeVisible();
    expect(screen.getByText("91%")).toBeVisible();
    expect(
      screen.getAllByText("Provenance unavailable.").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Source context unavailable.").length,
    ).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Proposed headline"), {
      target: { value: "Edited platform engineer" },
    });
    expect(screen.getByText("Unsaved review changes.")).toBeVisible();
    expect(addListener).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add all proposed skills" }),
    );
    const skillCard = screen
      .getByLabelText("Proposed skill")
      .closest("article");
    expect(skillCard).not.toBeNull();
    expect(
      within(skillCard as HTMLElement).getByRole("radio", { name: "add" }),
    ).toBeChecked();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("saves a complete payload, reconciles the server revision, and blocks duplicates", async () => {
    const next = {
      ...cvDraftReviewFixture,
      draftRevision: 1,
      proposals: {
        ...cvDraftReviewFixture.proposals,
        scalars: [
          {
            ...cvDraftReviewFixture.proposals.scalars[0],
            value: "Edited platform engineer",
          },
        ],
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            draftId: cvDraftReviewFixture.draftId,
            draftRevision: 1,
            reviewedProfileRevision: 2,
            savedAt: "2026-08-01T08:10:00.000Z",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(next), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <CvDraftReview initial={cvDraftReviewFixture} csrfProof="csrf_test" />,
    );
    fireEvent.change(screen.getByLabelText("Proposed headline"), {
      target: { value: "Edited platform engineer" },
    });
    const save = screen.getByRole("button", { name: "Save review" });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(request).toMatchObject({
      baseDraftRevision: 0,
      reviewedProfileRevision: 2,
    });
    expect(request.proposals.scalars[0].value).toBe("Edited platform engineer");
    expect(await screen.findByText("Review saved.")).toBeVisible();
    expect(screen.getByText("Review draft revision 1")).toBeVisible();
  });

  it("requires explicit impact acknowledgement and renders a non-content receipt", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(cvConfirmationReceiptFixture), {
        status: 201,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <CvDraftReview initial={cvDraftReviewFixture} csrfProof="csrf_test" />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm selected changes" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/acknowledge/i);
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /confirm updates my candidate profile/i,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm selected changes" }),
    );
    expect(
      await screen.findByRole("heading", { name: "CV import confirmed" }),
    ).toBeVisible();
    expect(screen.getByText(/candidate profile revision/i)).toHaveTextContent(
      "3",
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].headers["idempotency-key"]).toMatch(
      /^cv-confirm-/u,
    );
  });
});
