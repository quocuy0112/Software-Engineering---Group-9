"use client";

import { useRef } from "react";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";

export function ImageSearchInput({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect(file: File): void;
}) {
  const vi = useWorkspaceLocale() === "vi";
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="image-search-input">
      <input
        ref={input}
        id="global-image-search-file"
        className="image-search-file-input"
        type="file"
        aria-label={vi ? "Hình ảnh tin tuyển dụng" : "Job poster image"}
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        disabled={disabled}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) onSelect(file);
          event.currentTarget.value = "";
        }}
      />
      <label
        className="image-search-file-control"
        htmlFor="global-image-search-file"
        aria-disabled={disabled}
      >
        <span className="image-search-file-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="img">
            <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
            <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
          </svg>
        </span>
        <span>
          <strong>
            {vi ? "Chọn hình ảnh tin tuyển dụng" : "Choose a job poster"}
          </strong>
          <small>
            {vi
              ? "PNG hoặc JPEG · tối đa 5 MB · tối đa 20 MP"
              : "PNG or JPEG · up to 5 MB · maximum 20 MP"}
          </small>
        </span>
      </label>
    </div>
  );
}
