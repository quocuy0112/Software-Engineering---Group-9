"use client";

import { useState } from "react";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";

import {
  searchIntentSchema,
  type SearchIntent,
} from "@/shared/contracts/jobs/search-intent";

const fieldLabels: Record<SearchIntent["proposals"][number]["field"], string> =
  {
    q: "Job title or keyword",
    location: "Location",
    employmentType: "Employment type",
    experienceLevel: "Experience level",
    workArrangement: "Work arrangement",
    skills: "Skills",
    salaryMin: "Minimum salary",
    salaryMax: "Maximum salary",
    salaryCurrency: "Salary currency",
    salaryPeriod: "Salary period",
    postedWithinDays: "Posted within",
  };

const fieldLabelsVi: typeof fieldLabels = {
  q: "Chức danh hoặc từ khóa",
  location: "Địa điểm",
  employmentType: "Loại công việc",
  experienceLevel: "Cấp độ kinh nghiệm",
  workArrangement: "Hình thức làm việc",
  skills: "Kỹ năng",
  salaryMin: "Lương tối thiểu",
  salaryMax: "Lương tối đa",
  salaryCurrency: "Đơn vị tiền tệ",
  salaryPeriod: "Kỳ trả lương",
  postedWithinDays: "Thời gian đăng",
};

function visibleValue(proposal: SearchIntent["proposals"][number]) {
  if (proposal.stringValue !== null) return proposal.stringValue;
  if (proposal.numberValue !== null) return String(proposal.numberValue);
  return proposal.stringValues.join(", ");
}

function ProposalActionIcon({
  name,
}: {
  name: "check" | "clear" | "close" | "reverse";
}) {
  if (name === "check") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
        <path d="m4 10.25 3.6 3.6L16 5.75" />
      </svg>
    );
  }

  if (name === "reverse") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
        <path d="M15.5 6.5A6.5 6.5 0 0 0 4.75 4.7L3 6.5" />
        <path d="M3 3.5v3h3" />
        <path d="M4.5 13.5a6.5 6.5 0 0 0 10.75 1.8L17 13.5" />
        <path d="M17 16.5v-3h-3" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="m6 6 8 8M14 6l-8 8" />
    </svg>
  );
}

export function ImageSearchProposals({
  intent,
  onApply,
  onClear,
}: {
  intent: SearchIntent;
  onApply(intent: SearchIntent): void;
  onClear(): void;
}) {
  const vi = useWorkspaceLocale() === "vi";
  const labels = vi ? fieldLabelsVi : fieldLabels;
  const [draft, setDraft] = useState(intent);
  const [error, setError] = useState("");
  const selectedCount = draft.proposals.filter(
    (proposal) => proposal.selected,
  ).length;
  const uncertainOccupation = draft.proposals.find(
    (proposal) =>
      proposal.field === "q" &&
      (proposal.basis === "INFERRED" || proposal.confidence < 0.9),
  );
  const update = (id: string, value: string) =>
    setDraft((current) => ({
      ...current,
      proposals: current.proposals.map((proposal) => {
        if (proposal.id !== id) return proposal;
        if (proposal.numberValue !== null)
          return { ...proposal, numberValue: Number(value) };
        if (proposal.stringValue !== null)
          return { ...proposal, stringValue: value.slice(0, 200) };
        return {
          ...proposal,
          stringValues: value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 20),
        };
      }),
    }));
  return (
    <section
      className="image-search-proposal-review"
      aria-labelledby="image-search-proposals-heading"
    >
      <div className="image-search-proposal-heading">
        <h3 id="image-search-proposals-heading">
          {vi ? "Xem lại bộ lọc gợi ý" : "Review suggested filters"}
        </h3>
        <span>
          {vi
            ? `Tìm thấy ${draft.proposals.length}`
            : `${draft.proposals.length} found`}
        </span>
      </div>
      <p>
        {vi
          ? "Mọi bộ lọc đều không bắt buộc. Hãy chỉnh sửa, xóa hoặc đảo lựa chọn trước khi tìm."
          : "Every filter is optional. Edit, remove, or reverse selections before searching."}
      </p>
      {uncertainOccupation ? (
        <p className="image-search-occupation-confirmation">
          {vi
            ? `Đây có thể là vị trí “${visibleValue(uncertainOccupation)}”. Hãy chọn bên dưới nếu gợi ý này đúng.`
            : `This may be a “${visibleValue(uncertainOccupation)}” role. Is that what you want to search for? Select it below if the suggestion is correct.`}
        </p>
      ) : null}
      {!draft.proposals.length ? (
        <p>
          {vi
            ? "Không tìm thấy bộ lọc việc làm được hỗ trợ trong hình ảnh."
            : "No supported job-search filters were found in the image."}
        </p>
      ) : null}
      <ul className="image-search-proposals">
        {draft.proposals.map((proposal) => (
          <li key={proposal.id}>
            <div className="image-search-proposal-field-heading">
              <label>
                <input
                  type="checkbox"
                  checked={proposal.selected}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      proposals: current.proposals.map((item) =>
                        item.id === proposal.id
                          ? { ...item, selected: event.target.checked }
                          : item,
                      ),
                    }))
                  }
                />
                {labels[proposal.field]}
              </label>
              <button
                className="image-search-proposal-remove"
                type="button"
                aria-label={
                  vi
                    ? `Xóa ${labels[proposal.field]}`
                    : `Remove ${proposal.field}`
                }
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    proposals: current.proposals.filter(
                      (item) => item.id !== proposal.id,
                    ),
                  }))
                }
              >
                <ProposalActionIcon name="clear" />
                {vi ? "Xóa" : "Remove"}
              </button>
            </div>
            <input
              aria-label={
                vi
                  ? `Chỉnh sửa gợi ý ${labels[proposal.field]}`
                  : `Edit ${proposal.field} proposal`
              }
              value={visibleValue(proposal)}
              onChange={(event) => update(proposal.id, event.target.value)}
            />
            <div className="image-search-proposal-evidence">
              <span
                className={`image-confidence image-confidence-${proposal.confidence >= 0.9 ? "high" : "review"}`}
              >
                {proposal.confidence >= 0.9
                  ? vi
                    ? "Độ tin cậy cao"
                    : "High confidence"
                  : vi
                    ? "Nên xem lại"
                    : "Review suggested"}
              </span>
              <small
                title={proposal.evidence.map((item) => item.text).join(" · ")}
              >
                {vi ? "Nguồn" : "Source"}:{" "}
                {proposal.evidence.map((item) => item.text).join(" · ")}
              </small>
            </div>
          </li>
        ))}
      </ul>
      {error ? <p role="alert">{error}</p> : null}
      {draft.proposals.length ? (
        <div
          className="image-search-actions"
          data-has-bulk-actions={draft.proposals.length > 1}
          aria-label={
            vi ? "Thao tác với bộ lọc gợi ý" : "Suggested filter actions"
          }
        >
          <div className="image-search-action-edit">
            <p className="image-search-selection-summary" aria-live="polite">
              <strong>{selectedCount}</strong>
              <span>{vi ? "bộ lọc đã chọn" : "filters selected"}</span>
            </p>
            <div
              className="image-search-action-utilities"
              role="group"
              aria-label={vi ? "Chỉnh sửa lựa chọn" : "Edit selections"}
            >
              {draft.proposals.length > 1 ? (
                <button
                  className="image-search-reverse-button"
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      proposals: current.proposals.map((proposal) => ({
                        ...proposal,
                        selected: !proposal.selected,
                      })),
                    }))
                  }
                >
                  <ProposalActionIcon name="reverse" />
                  {vi ? "Đảo lựa chọn" : "Reverse selections"}
                </button>
              ) : null}
              <button
                className="image-search-clear-button"
                type="button"
                onClick={() =>
                  setDraft((current) => ({ ...current, proposals: [] }))
                }
              >
                <ProposalActionIcon name="clear" />
                {vi ? "Xóa tất cả gợi ý" : "Clear proposals"}
              </button>
            </div>
          </div>
          <div
            className="image-search-action-commit"
            role="group"
            aria-label={vi ? "Hoàn tất bộ lọc" : "Finish suggested filters"}
          >
            <button
              className="image-search-close-button"
              type="button"
              onClick={onClear}
            >
              <ProposalActionIcon name="close" />
              {vi ? "Đóng" : "Close"}
            </button>
            <button
              className="image-search-apply-button"
              type="button"
              aria-label={
                vi ? "Áp dụng bộ lọc đã chọn" : "Apply selected filters"
              }
              disabled={selectedCount === 0}
              onClick={() => {
                const parsed = searchIntentSchema.safeParse({
                  ...draft,
                  proposals: draft.proposals.map((proposal) => ({
                    ...proposal,
                    selected: false,
                  })),
                });
                if (!parsed.success) {
                  setError(
                    vi
                      ? "Hãy kiểm tra các giá trị đã chỉnh sửa trước khi áp dụng."
                      : "Review edited values before applying filters.",
                  );
                  return;
                }
                setError("");
                onApply(draft);
              }}
            >
              <ProposalActionIcon name="check" />
              {vi ? "Áp dụng bộ lọc đã chọn" : "Apply selected filters"}
              <span className="image-search-apply-count" aria-hidden="true">
                {selectedCount}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="image-search-empty-actions">
          <button
            className="image-search-close-button"
            type="button"
            onClick={onClear}
          >
            <ProposalActionIcon name="close" />
            {vi ? "Đóng" : "Close"}
          </button>
        </div>
      )}
    </section>
  );
}
