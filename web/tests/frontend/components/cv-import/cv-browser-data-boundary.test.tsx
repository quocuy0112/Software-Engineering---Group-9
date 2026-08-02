import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CvUploadForm } from "@/frontend/features/cv-import/components/cv-upload-form";

const canaries = Object.freeze({
  filename: "privacy-person@example.invalid.pdf",
  cvText: "PRIVACY_CANARY confidential employment narrative",
  token: "sk-PRIVACY_CANARY-never-store",
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("CV browser data boundary", () => {
  it("keeps synthetic CV PII/secrets in transient React/File memory only", async () => {
    const storageWrite = vi.spyOn(Storage.prototype, "setItem");
    const historyPush = vi.spyOn(history, "pushState");
    const historyReplace = vi.spyOn(history, "replaceState");
    const indexedDbOpen = globalThis.indexedDB
      ? vi.spyOn(globalThis.indexedDB, "open")
      : null;
    const cacheOpen = globalThis.caches
      ? vi.spyOn(globalThis.caches, "open")
      : null;
    const onUpload = vi.fn(async () => undefined);
    const { unmount } = render(
      <CvUploadForm csrfProof="csrf_browser_boundary" onUpload={onUpload} />,
    );
    const file = new File(
      [`${canaries.cvText}\n${canaries.token}`],
      canaries.filename,
      { type: "application/pdf" },
    );
    fireEvent.change(screen.getByLabelText("CV file"), {
      target: { files: [file] },
    });
    fireEvent.change(screen.getByLabelText("Parser"), {
      target: { value: "EXTERNAL_OPENAI" },
    });
    fireEvent.click(screen.getByRole("button", { name: /upload cv/i }));
    await waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
    expect(onUpload).toHaveBeenCalledWith(
      file,
      "EXTERNAL_OPENAI",
      "csrf_browser_boundary",
    );
    expect(storageWrite).not.toHaveBeenCalled();
    if (indexedDbOpen) expect(indexedDbOpen).not.toHaveBeenCalled();
    if (cacheOpen) expect(cacheOpen).not.toHaveBeenCalled();
    expect(historyPush).not.toHaveBeenCalled();
    expect(historyReplace).not.toHaveBeenCalled();
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
    expect(location.href).not.toContain(canaries.filename);
    expect(JSON.stringify(history.state)).not.toMatch(
      /PRIVACY_CANARY|privacy-person/iu,
    );
    unmount();
    expect(document.body).not.toHaveTextContent(canaries.filename);
  });
});
