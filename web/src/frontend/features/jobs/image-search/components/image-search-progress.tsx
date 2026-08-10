"use client";

import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";

export function ImageSearchProgress({
  progress,
  onCancel,
}: {
  progress: number;
  onCancel(): void;
}) {
  const vi = useWorkspaceLocale() === "vi";
  const message =
    progress <= 20
      ? vi
        ? "Đang tải lên an toàn"
        : "Uploading securely"
      : progress < 70
        ? vi
          ? "Đang quét và đọc văn bản"
          : "Scanning and reading text"
        : vi
          ? "Đang chuẩn bị bộ lọc có thể chỉnh sửa"
          : "Preparing editable filters";
  return (
    <div
      className="image-search-progress"
      aria-label={vi ? "Đang xử lý hình ảnh việc làm" : "Processing job image"}
      aria-live="polite"
      role="status"
    >
      <div className="image-search-progress-heading">
        <span className="image-search-progress-spinner" aria-hidden="true" />
        <span>
          <label htmlFor="image-search-progress">
            {vi ? "Đang xử lý hình ảnh việc làm" : "Processing job image"}
          </label>
          <small>{message}</small>
        </span>
        <strong>{progress}%</strong>
      </div>
      <progress id="image-search-progress" max={100} value={progress}>
        {progress}%
      </progress>
      <button type="button" onClick={onCancel}>
        {vi ? "Hủy tìm kiếm bằng hình ảnh" : "Cancel image search"}
      </button>
    </div>
  );
}
