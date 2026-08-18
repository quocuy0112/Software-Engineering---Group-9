import { describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  assertReady: vi.fn(),
  put: vi.fn(),
  open: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/backend/applications/storage/factory", () => ({
  createApplicationDocumentStorage: () => storage,
}));

import { ApplicationDraftService } from "@/backend/candidate-applications/application-draft-service";

const now = new Date("2026-08-18T08:00:00.000Z");

function draftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "draft-1",
    candidateUserId: "candidate-1",
    jobPostingId: "job-1",
    revision: 1,
    personalInfoDraft: {},
    selectedCv: null,
    coverLetterDraft: null,
    messageDraft: null,
    confirmationAccepted: false,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + 86_400_000),
    ...overrides,
  };
}

describe("ApplicationDraftService cover-letter persistence", () => {
  it("does not delete a file after its draft row was committed", async () => {
    storage.assertReady.mockResolvedValue(undefined);
    storage.put.mockResolvedValue({
      locator: "new-cover-letter-locator",
      bytes: 3,
      storagePurposeVersion: "application-document-v1",
    });
    storage.delete.mockResolvedValue({ deleted: true });

    let storedCoverLetterDraft: unknown = null;
    const db = {
      candidateApplicationDraft: {
        findFirst: vi.fn().mockResolvedValue(draftRow()),
        updateMany: vi.fn().mockImplementation(async (input) => {
          storedCoverLetterDraft = input.data.coverLetterDraft;
          return { count: 1 };
        }),
        findUnique: vi.fn().mockImplementation(async () =>
          draftRow({
            revision: 2,
            personalInfoDraft: {},
            coverLetterDraft: storedCoverLetterDraft,
          }),
        ),
      },
      jobApplication: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };

    await expect(
      new ApplicationDraftService(db as never).attachCoverLetter(
        { userId: "candidate-1", sessionId: "session-1" },
        "draft-1",
        1,
        new File([Uint8Array.of(1, 2, 3)], "cover.pdf", {
          type: "application/pdf",
        }),
        now,
      ),
    ).rejects.toThrow();

    expect(storedCoverLetterDraft).toMatchObject({
      kind: "FILE",
      file: { storageKey: "new-cover-letter-locator" },
    });
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
