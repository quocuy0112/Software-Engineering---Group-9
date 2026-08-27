"use client";

import { useState } from "react";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";

const categories = [
  "FRAUD_OR_IMPERSONATION",
  "MISLEADING_CONTENT",
  "DISCRIMINATION_OR_HARASSMENT",
  "ABUSE_OR_THREATS",
  "SPAM_OR_DUPLICATE",
  "PRIVACY_OR_DATA_MISUSE",
  "OTHER",
] as const;

export function ReportCandidateDialog(props: {
  applicationId: string;
  candidateAccountId: string;
  onClose: () => void;
}) {
  const locale = useWorkspaceLocale();
  const vi = locale === "vi";
  const copy = vi
    ? {
        title: "Báo cáo tương tác với ứng viên",
        category: "Danh mục",
        detail: "Chi tiết bổ sung",
        optional: "Không bắt buộc",
        cancel: "Hủy",
        submit: "Gửi báo cáo",
        retry: (seconds: number) => "Hãy thử lại sau " + seconds + " giây.",
        unavailable: "Không thể báo cáo đối tượng này.",
        success: "Báo cáo đã được gửi.",
      }
    : {
        title: "Report Candidate interaction",
        category: "Category",
        detail: "Optional detail",
        optional: "Optional",
        cancel: "Cancel",
        submit: "Submit report",
        retry: (seconds: number) => "Please retry in " + seconds + " seconds.",
        unavailable: "This report target is unavailable.",
        success: "Report submitted.",
      };
  const categoryLabels: Record<string, string> = vi
    ? {
        FRAUD_OR_IMPERSONATION: "Gian lận hoặc mạo danh",
        MISLEADING_CONTENT: "Nội dung gây hiểu lầm",
        DISCRIMINATION_OR_HARASSMENT: "Phân biệt đối xử hoặc quấy rối",
        ABUSE_OR_THREATS: "Lạm dụng hoặc đe dọa",
        SPAM_OR_DUPLICATE: "Spam hoặc trùng lặp",
        PRIVACY_OR_DATA_MISUSE: "Lạm dụng quyền riêng tư hoặc dữ liệu",
        OTHER: "Khác",
      }
    : Object.fromEntries(
        categories.map((category) => [category, category.replaceAll("_", " ")]),
      );
  const [category, setCategory] =
    useState<(typeof categories)[number]>("MISLEADING_CONTENT");
  const [detail, setDetail] = useState("");
  const [message, setMessage] = useState("");

  async function submit() {
    const response = await fetch("/api/moderation-reports", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target: {
          type: "CANDIDATE",
          reference: props.candidateAccountId,
          applicationReference: props.applicationId,
        },
        category,
        detail,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      message?: unknown;
      retryAfterSeconds?: unknown;
    };
    if (response.ok) {
      setMessage(
        !vi && typeof body.message === "string" ? body.message : copy.success,
      );
      return;
    }
    const retryAfterSeconds =
      typeof body.retryAfterSeconds === "number" ? body.retryAfterSeconds : 0;
    setMessage(
      response.status === 429 && retryAfterSeconds > 0
        ? copy.retry(retryAfterSeconds)
        : copy.unavailable,
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-candidate-title"
    >
      <h2 id="report-candidate-title">{copy.title}</h2>
      <label>
        {copy.category}
        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as (typeof categories)[number])
          }
        >
          {categories.map((value) => (
            <option key={value} value={value}>
              {categoryLabels[value]}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.detail} ({copy.optional})
        <textarea
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          maxLength={2000}
        />
      </label>
      {message && <p role="status">{message}</p>}
      <button type="button" onClick={props.onClose}>
        {copy.cancel}
      </button>
      <button type="button" onClick={() => void submit()}>
        {copy.submit}
      </button>
    </div>
  );
}
