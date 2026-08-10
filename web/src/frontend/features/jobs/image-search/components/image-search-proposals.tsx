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
            <input
              aria-label={
                vi
                  ? `Chỉnh sửa gợi ý ${labels[proposal.field]}`
                  : `Edit ${proposal.field} proposal`
              }
              value={visibleValue(proposal)}
              onChange={(event) => update(proposal.id, event.target.value)}
            />
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
            <small>
              {vi ? "Nguồn" : "Source"}:{" "}
              {proposal.evidence.map((item) => item.text).join(" · ")}
            </small>
            <button
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
              {vi ? "Xóa" : "Remove"}
            </button>
          </li>
        ))}
      </ul>
      {error ? <p role="alert">{error}</p> : null}
      <div className="image-search-actions">
        <button
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
          {vi ? "Đảo lựa chọn" : "Reverse selections"}
        </button>
        <button
          type="button"
          onClick={() => setDraft({ ...draft, proposals: [] })}
        >
          {vi ? "Xóa tất cả gợi ý" : "Clear proposals"}
        </button>
        <button
          className="image-search-apply-button"
          type="button"
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
          {vi ? "Áp dụng bộ lọc đã chọn" : "Apply selected filters"}
        </button>
        <button type="button" onClick={onClear}>
          {vi ? "Đóng" : "Close"}
        </button>
      </div>
    </section>
  );
}
