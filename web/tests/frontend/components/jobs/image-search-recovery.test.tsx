import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useImageSearch } from "@/frontend/features/jobs/image-search/client/use-image-search";

const api = vi.hoisted(() => ({
  reserveImageSearch: vi.fn(),
  uploadImageSearchContent: vi.fn(),
  getImageSearchStatus: vi.fn(),
  consumeImageSearchResult: vi.fn(),
  cancelImageSearch: vi.fn(),
  revokeImageSearchConsent: vi.fn(),
}));

vi.mock(
  "@/frontend/features/jobs/image-search/client/image-search-api",
  () => api,
);

const criteria = {
  q: "",
  location: "",
  employmentType: [],
  experienceLevel: [],
  workArrangement: [],
  skills: [],
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: "VND",
  salaryPeriod: "YEAR" as const,
  postedWithinDays: null,
  sort: "RELEVANCE" as const,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function image(name: string) {
  return new File([new Uint8Array([137, 80, 78, 71])], name, {
    type: "image/png",
  });
}

describe("image-search client recovery races", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.cancelImageSearch.mockResolvedValue(undefined);
    api.uploadImageSearchContent.mockResolvedValue(undefined);
  });

  it("discards and cancels a late reservation after a newer image starts", async () => {
    const older = deferred<{ queryId: string; capability: string }>();
    api.reserveImageSearch
      .mockImplementationOnce(() => older.promise)
      .mockResolvedValueOnce({
        queryId: "new-query",
        capability: "new-capability",
      });
    api.getImageSearchStatus.mockResolvedValue({ state: "OCR_QUEUED" });
    const { result } = renderHook(() =>
      useImageSearch({
        currentCriteria: criteria,
        csrfProof: "csrf-proof",
        externalInterpretation: false,
      }),
    );

    let oldStart!: Promise<void>;
    let newStart!: Promise<void>;
    await act(async () => {
      oldStart = result.current.start(image("old.png"));
      await Promise.resolve();
      newStart = result.current.start(image("new.png"));
      await Promise.resolve();
    });
    expect(api.uploadImageSearchContent).toHaveBeenCalledWith(
      expect.objectContaining({ queryId: "new-query" }),
    );

    await act(async () => {
      older.resolve({ queryId: "old-query", capability: "old-capability" });
      await oldStart;
    });
    expect(api.uploadImageSearchContent).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryId: "old-query" }),
    );
    expect(api.cancelImageSearch).toHaveBeenCalledWith(
      expect.objectContaining({ queryId: "old-query" }),
    );

    await act(async () => {
      await result.current.cancel();
      await newStart;
    });
  });

  it("cancels processing when visible manual criteria change", async () => {
    api.reserveImageSearch.mockResolvedValue({
      queryId: "criteria-query",
      capability: "criteria-capability",
    });
    api.getImageSearchStatus.mockImplementation(
      (_input: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          _input.signal.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            {
              once: true,
            },
          );
        }),
    );
    const { result, rerender } = renderHook(
      ({ q }) =>
        useImageSearch({
          currentCriteria: { ...criteria, q },
          csrfProof: "csrf-proof",
          externalInterpretation: false,
        }),
      { initialProps: { q: "manual one" } },
    );
    await act(async () => {
      void result.current.start(image("criteria.png"));
      await Promise.resolve();
      await Promise.resolve();
    });
    rerender({ q: "manual two" });
    await waitFor(() =>
      expect(api.cancelImageSearch).toHaveBeenCalledWith(
        expect.objectContaining({ queryId: "criteria-query" }),
      ),
    );
    expect(result.current.phase).toBe("IDLE");
  });
});
