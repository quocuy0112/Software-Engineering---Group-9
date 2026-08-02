import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CvFailureRecovery } from "@/frontend/features/cv-import/components/cv-failure-recovery";
import { cvImportResourceSchema } from "@/shared/contracts/cv-import/upload";

const failureResource = cvImportResourceSchema.parse({
  uploadId: "upload_failure_accessibility_1234",
  displayFilename: null,
  documentKind: "PDF",
  parserClass: "DETERMINISTIC_INTERNAL",
  status: "SCAN_FAILED",
  stage: "TERMINAL",
  availableActions: ["RETRY", "DELETE", "MANUAL_PROFILE"],
  scanRetriesRemaining: 2,
  parseRetriesRemaining: 2,
  createdAt: "2026-08-01T08:00:00.000Z",
  expiresAt: "2026-08-31T08:00:00.000Z",
  draft: null,
  processingNotice: {
    noticeVersion: "cv-processing.v1",
    noticeText: "Synthetic processing notice.",
    externalConsentRequiredFor: [],
  },
  consent: null,
  failure: {
    code: "SCANNER_UNAVAILABLE",
    message:
      "Processing could not finish. You may retry or update your profile manually.",
    retryable: true,
    suggestedActions: ["RETRY", "MANUAL_PROFILE", "DELETE"],
  },
  receipt: null,
  contentInaccessibleAt: null,
  deleteAfter: null,
  deletedAt: null,
});

describe("CV failure recovery accessibility", () => {
  it("focuses the stable error summary and announces countdown/action changes", async () => {
    const onRetry = vi.fn(async () => undefined);
    render(
      <CvFailureRecovery
        resource={failureResource}
        retryAfterSeconds={0}
        onDelete={vi.fn()}
        onRetry={onRetry}
      />,
    );

    const summary = screen.getByRole("heading", {
      name: /cv processing could not finish/i,
    });
    await waitFor(() => expect(summary).toHaveFocus());
    expect(screen.getByRole("alert")).toHaveAccessibleName();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveAttribute("aria-atomic", "true");

    const retry = screen.getByRole("button", { name: /retry scan/i });
    retry.focus();
    fireEvent.keyDown(retry, { key: "Enter" });
    fireEvent.click(retry);
    await waitFor(() => expect(onRetry).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent(/retry queued/i);
  });

  it("keeps every recovery action keyboard reachable without administrator guidance", () => {
    render(
      <CvFailureRecovery
        resource={failureResource}
        retryAfterSeconds={0}
        onDelete={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    const root = screen.getByTestId("cv-failure-recovery");
    const controls = Array.from(
      root.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>(
        "button:not([disabled]), a[href]",
      ),
    );
    expect(controls).toHaveLength(4);
    for (const control of controls)
      expect(control.tabIndex).toBeGreaterThanOrEqual(0);
    expect(root).not.toHaveTextContent(
      /administrator|operator|dead[- ]?letter|dlq/i,
    );
  });

  it("declares owned 320px, focus, contrast, error, and reduced-motion behavior", async () => {
    render(
      <CvFailureRecovery
        resource={failureResource}
        retryAfterSeconds={0}
        onDelete={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    const root = screen.getByTestId("cv-failure-recovery");
    expect(root).toHaveAttribute("data-narrow-layout", "320");
    expect(root).toHaveAttribute("data-reduced-motion-safe", "true");

    const css = await readFile(
      resolve(
        process.cwd(),
        "src/frontend/features/cv-import/components/cv-failure-recovery.module.css",
      ),
      "utf8",
    );
    expect(css).toMatch(/@media\s*\(max-width:\s*32rem\)/u);
    expect(css).toMatch(/focus-visible/u);
    expect(css).toMatch(/prefers-reduced-motion/u);
    expect(css).toMatch(/--color-error/u);
    expect(css).not.toMatch(/:global/u);
  });
});
