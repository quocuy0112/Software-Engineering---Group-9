"use client";

import type { ImageSearchFallbackReason } from "../client/use-image-search";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";

const fallbackContent: Record<
  ImageSearchFallbackReason,
  { heading: string; description: string }
> = {
  LOW_CONFIDENCE: {
    heading: "Image text was not clear enough",
    description:
      "OpenAI did not receive sufficiently reliable text to create job filters. Try a clearer image.",
  },
  INTERPRETER_UNAVAILABLE: {
    heading: "AI filter suggestions are unavailable",
    description:
      "OpenAI could not create filter suggestions for this image. No recognized text was added to your search.",
  },
  INTERPRETER_INVALID_OUTPUT: {
    heading: "AI filters need another attempt",
    description:
      "The AI response could not be converted into supported job filters. No recognized text was added to your search.",
  },
  UNKNOWN: {
    heading: "No compatible AI filters were created",
    description:
      "This image did not produce supported job filters. No recognized text was added to your search.",
  },
};

export function ImageSearchRecovery({
  error,
  fallbackReason,
  retryAt,
  onRetry,
  onManual,
}: {
  error: string | null;
  fallbackReason: ImageSearchFallbackReason | null;
  retryAt?: string | null;
  onRetry(): void;
  onManual(): void;
}) {
  const vi = useWorkspaceLocale() === "vi";
  if (fallbackReason) {
    const content = vi
      ? {
          LOW_CONFIDENCE: {
            heading: "Văn bản trong ảnh chưa đủ rõ",
            description:
              "Không có bộ lọc nào được thêm. Hãy thử một hình ảnh rõ hơn.",
          },
          INTERPRETER_UNAVAILABLE: {
            heading: "Chưa thể đề xuất bộ lọc",
            description:
              "Không có văn bản nhận dạng nào được thêm vào tìm kiếm của bạn.",
          },
          INTERPRETER_INVALID_OUTPUT: {
            heading: "Cần thử lại để tạo bộ lọc",
            description:
              "Kết quả chưa thể chuyển thành bộ lọc được hỗ trợ. Tìm kiếm hiện tại vẫn giữ nguyên.",
          },
          UNKNOWN: {
            heading: "Không tìm thấy bộ lọc phù hợp",
            description:
              "Hình ảnh này không tạo được bộ lọc được hỗ trợ. Tìm kiếm hiện tại vẫn giữ nguyên.",
          },
        }[fallbackReason]
      : fallbackContent[fallbackReason];
    return (
      <div
        role="status"
        className="image-search-recovery image-search-recovery-warning"
      >
        <h3>{content.heading}</h3>
        <p>{content.description}</p>
        <button type="button" onClick={onRetry}>
          {vi ? "Thử hình ảnh khác" : "Try another image"}
        </button>
        <button type="button" onClick={() => onManual()}>
          {vi ? "Tiếp tục tìm việc" : "Continue to Find jobs"}
        </button>
      </div>
    );
  }
  if (!error) return null;
  const retryDate = retryAt ? new Date(retryAt) : null;
  const retryLabel =
    retryDate && !Number.isNaN(retryDate.getTime())
      ? retryDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;
  return (
    <div
      role="alert"
      className="image-search-recovery image-search-recovery-error"
    >
      <h3>
        {vi
          ? "Tìm kiếm bằng hình ảnh chưa khả dụng"
          : "Image search unavailable"}
      </h3>
      <p>{error}</p>
      {retryLabel ? (
        <p>
          {vi ? `Thử lại sau ${retryLabel}.` : `Try again after ${retryLabel}.`}
        </p>
      ) : null}
      <p>
        {vi
          ? "Bạn vẫn có thể tìm kiếm bằng văn bản."
          : "Ordinary text search is still available."}
      </p>
      <button type="button" onClick={onRetry}>
        {vi ? "Thử hình ảnh khác" : "Try another image"}
      </button>
      <button type="button" onClick={() => onManual()}>
        {vi ? "Tìm kiếm thủ công" : "Search manually"}
      </button>
    </div>
  );
}
