"use client";

import { useState } from "react";
import type { RankedApplicationRow } from "@/shared/contracts/scoring";
import { RankingModalFrame } from "./ranking-modal-frame";

const options = [["HIGH", "High review priority"], ["NORMAL", "Normal"], ["LOW", "Low"], ["HOLD", "Hold"]] as const;

export function ManualPriorityModal({ candidate, onCancel, onCompleted }: { candidate: RankedApplicationRow; onCancel: () => void; onCompleted: () => void }) {
  const [value, setValue] = useState<"HIGH" | "NORMAL" | "LOW" | "HOLD" | "">(candidate.manualPriority?.value ?? "");
  const [reason, setReason] = useState(candidate.manualPriority?.reason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!value || !reason.trim()) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/recruiter/applications/" + encodeURIComponent(candidate.applicationId) + "/priority", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": globalThis.crypto?.randomUUID?.() ?? "priority-" + Date.now() }, body: JSON.stringify({ confirmed: true, value, reason: reason.trim(), expectedVersion: candidate.manualPriority?.version ?? 0 }) });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message ?? "Priority could not be saved.");
      onCompleted();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Priority could not be saved."); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!candidate.manualPriority) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/recruiter/applications/" + encodeURIComponent(candidate.applicationId) + "/priority", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": globalThis.crypto?.randomUUID?.() ?? "priority-remove-" + Date.now() }, body: JSON.stringify({ action: "remove", confirmed: true, reason: "Recruiter removed manual priority.", expectedVersion: candidate.manualPriority.version }) });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message ?? "Priority could not be removed.");
      onCompleted();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Priority could not be removed."); }
    finally { setSaving(false); }
  };
  return <RankingModalFrame title="Set manual candidate priority" subtitle={candidate.candidate.displayName + " - Recruiter override"} icon={String.fromCharCode(9734)} info="The AI score stays unchanged. This entry is marked Manually prioritized and is preserved during rescoring." confirmLabel={saving ? "Saving..." : "Save priority"} onCancel={onCancel} onConfirm={() => void save()} confirmDisabled={!value || !reason.trim() || saving}><div className="ai-ranking-reference-block"><span>AI-suggested score order</span><strong>{candidate.scoreSummary.final === null ? "Not calculated" : "Final score " + candidate.scoreSummary.final}</strong><small>Read-only reference</small></div><label className="ai-ranking-field"><span>Manual priority <em>Required</em></span><select value={value} onChange={(event) => setValue(event.target.value as typeof value)}><option value="">Select a priority</option>{options.map(([option, label]) => <option key={option} value={option}>{label}</option>)}</select></label><label className="ai-ranking-field"><span>Reason for manual override <em>Required</em></span><textarea value={reason} maxLength={1_000} onChange={(event) => setReason(event.target.value)} placeholder="Explain what informed this recruiter decision." rows={4} /></label>{candidate.manualPriority ? <button type="button" className="ai-ranking-text-button ai-ranking-text-button--danger" onClick={() => void remove()} disabled={saving}>Remove manual priority</button> : null}{error ? <p className="ai-ranking-error" role="alert">{error}</p> : null}</RankingModalFrame>;
}
