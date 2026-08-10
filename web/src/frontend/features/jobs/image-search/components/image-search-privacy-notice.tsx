"use client";

import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";

export function ImageSearchPrivacyNotice() {
  const vi = useWorkspaceLocale() === "vi";
  return (
    <div className="image-search-privacy" role="note">
      <strong>
        {vi
          ? "Hình ảnh được xử lý riêng tư và tạm thời"
          : "Private, temporary image processing"}
      </strong>
      <p>
        {vi
          ? "SmartHire chỉ quét và nhận dạng văn bản để đề xuất bộ lọc việc làm. Hình ảnh và văn bản nhận dạng được xóa trong vòng 15 phút; không dùng để phân tích khuôn mặt, danh tính, thuộc tính nhạy cảm hoặc ứng viên."
          : "SmartHire scans and recognizes text only to propose public job filters. Images and recognized text are deleted within 15 minutes and are not used for face, identity, protected-attribute, or candidate analysis."}
      </p>
    </div>
  );
}
