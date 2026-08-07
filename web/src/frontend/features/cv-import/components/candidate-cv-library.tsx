"use client";

import { useState } from "react";

import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import {
  candidateCvDeleteOutcomeSchema,
  candidateCvSummarySchema,
  type CandidateCvSummary,
} from "@/shared/contracts/cv-import/candidate-cv";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import styles from "./candidate-cv-library.module.css";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function CandidateCvLibrary({
  csrfProof,
  initialItems,
}: {
  csrfProof: string;
  initialItems: readonly CandidateCvSummary[];
}) {
  const locale = useWorkspaceLocale();
  const [items, setItems] = useState(() => [...initialItems]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function beginRename(item: CandidateCvSummary) {
    setEditingId(item.id);
    setDraftName(item.displayName);
    setError(null);
  }

  async function saveRename(item: CandidateCvSummary) {
    const displayName = draftName.trim();
    if (!displayName) {
      setError(
        locale === "vi"
          ? "Hãy nhập tên hiển thị cho CV."
          : "Enter a display name for this CV.",
      );
      return;
    }
    setPendingId(item.id);
    setError(null);
    try {
      const response = await mutateWithCurrentCsrf(
        `/api/account/candidate-cvs/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName }),
        },
        csrfProof,
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          typeof (body as { message?: unknown } | null)?.message === "string"
            ? (body as { message: string }).message
            : "Unable to rename this CV.",
        );
      const updated = candidateCvSummarySchema.parse(body);
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === updated.id ? updated : candidate,
        ),
      );
      setEditingId(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to rename this CV.",
      );
    } finally {
      setPendingId(null);
    }
  }

  async function deleteCv(item: CandidateCvSummary) {
    const confirmed = window.confirm(
      locale === "vi"
        ? `Xóa CV “${item.displayName}” khỏi thư viện CV?`
        : `Remove “${item.displayName}” from your CV library?`,
    );
    if (!confirmed) return;
    setPendingId(item.id);
    setError(null);
    try {
      const response = await mutateWithCurrentCsrf(
        `/api/account/candidate-cvs/${encodeURIComponent(item.id)}`,
        { method: "DELETE" },
        csrfProof,
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          typeof (body as { message?: unknown } | null)?.message === "string"
            ? (body as { message: string }).message
            : "Unable to delete this CV.",
        );
      const deleted = candidateCvDeleteOutcomeSchema.parse(body);
      setItems((current) =>
        current.filter((candidate) => candidate.id !== deleted.id),
      );
      if (editingId === deleted.id) setEditingId(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to delete this CV.",
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section
      className={styles.root}
      aria-labelledby="candidate-cv-library-heading"
    >
      <header className={styles.heading}>
        <div>
          <p className={styles.kicker}>APPLICATION CVs</p>
          <h2 id="candidate-cv-library-heading">
            {locale === "vi" ? "CV đã lưu" : "Saved CVs"}
          </h2>
        </div>
        <span>{items.length}</span>
      </header>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {items.length ? (
        <ul className={styles.list}>
          {items.map((item) => {
            const pending = pendingId === item.id;
            const editing = editingId === item.id;
            return (
              <li className={styles.item} key={item.id}>
                <div className={styles.copy}>
                  {editing ? (
                    <label>
                      <span className={styles.srOnly}>CV display name</span>
                      <input
                        value={draftName}
                        maxLength={200}
                        disabled={pending}
                        onChange={(event) => setDraftName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void saveRename(item);
                          }
                        }}
                      />
                    </label>
                  ) : (
                    <strong>{item.displayName}</strong>
                  )}
                  <span>
                    {item.fileName} · {formatBytes(item.byteSize)}
                  </span>
                </div>
                <div className={styles.actions}>
                  {editing ? (
                    <>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void saveRename(item)}
                      >
                        {locale === "vi" ? "Lưu" : "Save"}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setEditingId(null)}
                      >
                        {locale === "vi" ? "Hủy" : "Cancel"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => beginRename(item)}
                    >
                      {locale === "vi" ? "Đổi tên" : "Rename"}
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.delete}
                    disabled={pending}
                    onClick={() => void deleteCv(item)}
                  >
                    {locale === "vi" ? "Xóa" : "Delete"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.empty}>
          {locale === "vi"
            ? "Chưa có CV đã xác nhận trong hồ sơ."
            : "No confirmed CVs are available in your Profile yet."}
        </p>
      )}
    </section>
  );
}
