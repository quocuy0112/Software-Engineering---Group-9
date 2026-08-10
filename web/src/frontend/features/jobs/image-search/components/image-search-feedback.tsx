"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";

import type { ImageSearchFallbackReason } from "../client/use-image-search";

type FeedbackPhase =
  | "IDLE"
  | "UPLOADING"
  | "PROCESSING"
  | "READY"
  | "FALLBACK"
  | "ERROR";

function retryDescription(
  error: string,
  retryAt: string | null,
  locale: "vi" | "en",
) {
  if (!retryAt) return error;
  const retryDate = new Date(retryAt);
  if (Number.isNaN(retryDate.getTime())) return error;
  const time = retryDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return locale === "vi"
    ? `${error} Hãy thử lại sau ${time}.`
    : `${error} Try again after ${time}.`;
}

export function ImageSearchFeedback({
  phase,
  error,
  fallbackReason,
  retryAt,
  proposalCount,
  warningCount,
}: {
  phase: FeedbackPhase;
  error: string | null;
  fallbackReason: ImageSearchFallbackReason | null;
  retryAt: string | null;
  proposalCount: number;
  warningCount: number;
}) {
  const locale = useWorkspaceLocale();
  const vi = locale === "vi";
  useEffect(() => {
    if (phase === "ERROR" && error) {
      toast.error(
        vi
          ? "Không thể tiếp tục tìm bằng hình ảnh"
          : "Image search could not continue",
        {
          id: "image-search-feedback",
          description: retryDescription(error, retryAt, locale),
          duration: 8_000,
        },
      );
      return;
    }
    if (phase === "FALLBACK") {
      const invalid = fallbackReason === "INTERPRETER_INVALID_OUTPUT";
      const lowConfidence = fallbackReason === "LOW_CONFIDENCE";
      toast.warning(
        lowConfidence
          ? vi
            ? "Văn bản trong ảnh chưa đủ rõ"
            : "Image text was not clear enough"
          : invalid
            ? vi
              ? "Cần thử lại để tạo bộ lọc"
              : "AI filters need another attempt"
            : vi
              ? "Chưa thể đề xuất bộ lọc"
              : "AI filter suggestions are unavailable",
        {
          id: "image-search-feedback",
          description: vi
            ? "Không có văn bản nhận dạng nào được thêm vào bộ lọc hoặc ô tìm kiếm."
            : "No recognized text was added to the header search or Find jobs filters.",
          duration: 7_000,
        },
      );
      return;
    }
    if (phase !== "READY") return;
    if (proposalCount === 0 || warningCount > 0) {
      toast.warning(
        vi
          ? "Bộ lọc đã sẵn sàng để xem lại"
          : "Job filters are ready for review",
        {
          id: "image-search-feedback",
          description:
            proposalCount === 0
              ? vi
                ? "Không tìm thấy bộ lọc đủ tin cậy. Bạn vẫn có thể tìm việc theo cách thông thường."
                : "No reliable filters were found. Ordinary job search is still available."
              : vi
                ? `Đã tìm thấy ${proposalCount} bộ lọc gợi ý; hãy xem lại hướng dẫn trước khi áp dụng.`
                : `${proposalCount} suggested ${proposalCount === 1 ? "filter" : "filters"} found; review the highlighted guidance before applying them.`,
          duration: 7_000,
        },
      );
      return;
    }
    toast.success(
      vi ? "Bộ lọc việc làm đã sẵn sàng" : "Job filters are ready",
      {
        id: "image-search-feedback",
        description: vi
          ? `Đã tìm thấy ${proposalCount} bộ lọc gợi ý. Chỉ áp dụng những mục bạn muốn.`
          : `${proposalCount} suggested ${proposalCount === 1 ? "filter" : "filters"} found. Review and apply only what you want.`,
        duration: 5_000,
      },
    );
  }, [
    error,
    fallbackReason,
    locale,
    phase,
    proposalCount,
    retryAt,
    vi,
    warningCount,
  ]);

  return null;
}
