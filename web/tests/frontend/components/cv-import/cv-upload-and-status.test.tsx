import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CvImportList } from "@/frontend/features/cv-import/components/cv-import-list";
import { CvImportStatus } from "@/frontend/features/cv-import/components/cv-import-status";
import { CvProcessingNotice } from "@/frontend/features/cv-import/components/cv-processing-notice";
import { CvUploadForm } from "@/frontend/features/cv-import/components/cv-upload-form";
import { CV_PROCESSING_NOTICES } from "@/shared/contracts/cv-import/upload";

describe("CV upload and authoritative status UI", () => {
  it("shows a versioned notice for each explicit parser choice", () => {
    const { rerender } = render(
      <CvProcessingNotice parserClass="DETERMINISTIC_INTERNAL" />,
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      CV_PROCESSING_NOTICES.DETERMINISTIC_INTERNAL.noticeText,
    );
    rerender(<CvProcessingNotice parserClass="EXTERNAL_OPENAI" />);
    expect(screen.getByRole("note")).toHaveTextContent(
      CV_PROCESSING_NOTICES.EXTERNAL_OPENAI.noticeText,
    );
    expect(screen.getByRole("note")).toHaveAttribute(
      "data-notice-version",
      CV_PROCESSING_NOTICES.EXTERNAL_OPENAI.noticeVersion,
    );
  });

  it("defers exact external consent to the server-bound status lifecycle", () => {
    render(<CvUploadForm csrfProof="csrf_fixture" onUpload={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Parser"), {
      target: { value: "EXTERNAL_OPENAI" },
    });
    expect(screen.getByRole("note")).toHaveTextContent(
      /blocked until you separately consent/i,
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload cv/i })).toBeEnabled();
  });

  it("validates exact type/5 MB, uploads by keyboard, and preserves text progress", async () => {
    const onUpload = vi.fn(async () => undefined);
    render(<CvUploadForm csrfProof="csrf_fixture" onUpload={onUpload} />);
    const input = screen.getByLabelText("CV file");
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array(5_000_001)], "too-large.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("5 MB");
    expect(input).toHaveFocus();

    fireEvent.change(input, {
      target: {
        files: [
          new File(["%PDF-synthetic"], "synthetic.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });
    fireEvent.keyDown(screen.getByRole("button", { name: /upload cv/i }), {
      key: "Enter",
    });
    fireEvent.click(screen.getByRole("button", { name: /upload cv/i }));
    await waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent(/upload/i);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("renders list/empty/quota and persistent non-color status actions", () => {
    const { rerender } = render(<CvImportList items={[]} />);
    expect(screen.getByText(/no cv imports yet/i)).toBeVisible();
    rerender(
      <CvImportList
        items={[
          {
            uploadId: "upload_fixture_1234",
            displayFilename: "synthetic.pdf",
            documentKind: "PDF",
            parserClass: "DETERMINISTIC_INTERNAL",
            status: "SCAN_QUEUED",
            createdAt: "2026-08-01T00:00:00.000Z",
            expiresAt: "2026-08-31T00:00:00.000Z",
            confirmedAt: null,
          },
        ]}
      />,
    );
    expect(screen.getByText("synthetic.pdf")).toBeVisible();
    rerender(
      <CvImportStatus
        resource={{
          uploadId: "upload_fixture_1234",
          status: "SCAN_FAILED",
          stage: "SCAN",
          availableActions: ["RETRY", "DELETE", "MANUAL_PROFILE"],
          pollingAfterMs: 5_000,
        }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/scan failed/i);
    expect(screen.getByRole("button", { name: /retry/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /manual profile/i })).toBeVisible();
  });

  it("cleans status polling on unmount", async () => {
    const clear = vi.spyOn(globalThis, "clearTimeout");
    const loadStatus = vi.fn(async () => ({
      uploadId: "upload_fixture_1234",
      status: "SCANNING" as const,
      stage: "SCAN" as const,
      availableActions: [],
      pollingAfterMs: 50,
    }));
    const { unmount } = render(
      <CvImportStatus resource={await loadStatus()} loadStatus={loadStatus} />,
    );
    unmount();
    expect(clear).toHaveBeenCalled();
  });
});
