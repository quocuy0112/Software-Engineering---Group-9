"use client";

import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";

export function ImageSearchConsent({
  selected,
  onChange,
}: {
  selected: boolean;
  onChange(selected: boolean): void;
}) {
  const vi = useWorkspaceLocale() === "vi";
  return (
    <fieldset className="image-search-consent">
      <legend>
        {vi
          ? "Đồng ý xử lý hình ảnh (bắt buộc)"
          : "Required AI processing consent"}
      </legend>
      <label>
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onChange(event.target.checked)}
        />
        {vi
          ? "Tôi đồng ý để SmartHire chỉ gửi phần văn bản nhận dạng từ hình ảnh này đến dịch vụ AI đã được phê duyệt nhằm tạo bộ lọc tìm việc có thể chỉnh sửa cho yêu cầu này."
          : "I agree that SmartHire may send only the recognized text from this image to the approved OpenAI deployment to create editable job-search filters for this request."}
      </label>
      <p>
        {vi
          ? "Tìm kiếm bằng hình ảnh sử dụng AI. Lựa chọn này mặc định tắt và chỉ áp dụng cho yêu cầu hiện tại. Bạn vẫn có thể tìm bằng văn bản mà không cần đồng ý."
          : "Image search is AI-only. Consent starts off and applies only to this request. Ordinary text search remains available without consent."}
      </p>
    </fieldset>
  );
}
