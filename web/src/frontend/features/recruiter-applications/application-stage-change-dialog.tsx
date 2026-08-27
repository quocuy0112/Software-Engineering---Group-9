"use client";

import { useState } from "react";
import { Modal } from "@/frontend/components/ui/modal";
import {
  rejectionReasonCodeSchema,
  type ApplicationStage,
  type PipelineApplicationCard,
  type StageTransitionCommand,
} from "@/shared/contracts/applications";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { recruiterApplicationsCopy } from "./recruiter-applications-copy";

export function stageTransitionNeedsDialog(target: ApplicationStage) {
  return (
    target === "REJECTED" || target === "OFFER_DECLINED" || target === "HIRED"
  );
}

export function ApplicationStageChangeDialog({
  card,
  initialTarget,
  fixedTarget,
  title,
  description,
  busy = false,
  onCancel,
  onSubmit,
}: {
  card: PipelineApplicationCard;
  initialTarget?: ApplicationStage;
  fixedTarget?: ApplicationStage;
  title?: string;
  description?: string;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (
    target: ApplicationStage,
    extras: Omit<
      StageTransitionCommand,
      "targetStage" | "expectedStageVersion"
    >,
  ) => void;
}) {
  const copy = recruiterApplicationsCopy(useWorkspaceLocale());
  const pipelineCopy = copy.pipeline;
  const dialogCopy = copy.stageDialog;
  // The destination list is intentionally taken verbatim from the server
  // projection. The client does not recreate or narrow transition policy.
  const allowedDestinations = card.allowedDestinations;
  const fixedTargetAllowed =
    fixedTarget !== undefined &&
    (allowedDestinations.includes(fixedTarget) ||
      (card.dragDestinations ?? []).includes(fixedTarget));
  const initialDialogTarget =
    fixedTargetAllowed && fixedTarget
      ? fixedTarget
      : initialTarget && allowedDestinations.includes(initialTarget)
        ? initialTarget
        : "";
  const [target, setTarget] = useState<ApplicationStage | "">(
    initialDialogTarget,
  );
  const [reasonCode, setReasonCode] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const consequential = target ? stageTransitionNeedsDialog(target) : false;
  const rejection = target === "REJECTED";
  const reasonRequired = rejection || target === "OFFER_DECLINED";
  const valid =
    Boolean(target) && (!reasonRequired || Boolean(reasonCode.trim()));
  const actionLabel = rejection
    ? dialogCopy.confirmRejection
    : target === "HIRED"
      ? dialogCopy.confirmHiring
      : target === "OFFER_DECLINED"
        ? dialogCopy.confirmOfferDeclined
        : target
          ? dialogCopy.confirmStageChange
          : dialogCopy.changeStage;

  return (
    <Modal
      open
      title={title ?? dialogCopy.titleFor(card.candidate.displayName)}
      description={description ?? dialogCopy.description}
      tone={rejection ? "destructive" : "standard"}
      busy={busy}
      onClose={onCancel}
    >
      <div className="pipeline-stage-form">
        {fixedTarget ? (
          <p role="note">
            {dialogCopy.destination}:{" "}
            <strong>{pipelineCopy.stageLabels[fixedTarget]}</strong>
          </p>
        ) : (
          <label>
            {dialogCopy.destination}
            <select
              data-autofocus
              value={target}
              onChange={(event) => {
                setTarget(event.target.value as ApplicationStage);
                setReasonCode("");
                setInternalNote("");
              }}
            >
              <option value="">{dialogCopy.chooseStage}</option>
              {allowedDestinations.map((stage) => (
                <option key={stage} value={stage}>
                  {pipelineCopy.stageLabels[stage]}
                </option>
              ))}
            </select>
          </label>
        )}
        {rejection ? (
          <>
            <label>
              {dialogCopy.rejectionReason}
              <select
                required
                value={reasonCode}
                onChange={(event) => setReasonCode(event.target.value)}
              >
                <option value="">{dialogCopy.chooseReason}</option>
                {rejectionReasonCodeSchema.options.map((reason) => (
                  <option key={reason} value={reason}>
                    {dialogCopy.rejectionReasons[reason]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {dialogCopy.privateNote}
              <textarea
                maxLength={2_000}
                value={internalNote}
                onChange={(event) => setInternalNote(event.target.value)}
              />
              <small>{dialogCopy.neverShared}</small>
            </label>
          </>
        ) : null}
        {target === "OFFER_DECLINED" ? (
          <label>
            {dialogCopy.offerDeclinedReason}
            <input
              required
              maxLength={80}
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
            />
          </label>
        ) : null}
        <div className="sh-modal-actions">
          <button type="button" disabled={busy} onClick={onCancel}>
            {dialogCopy.cancel}
          </button>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={() =>
              target &&
              onSubmit(target, {
                confirmed: consequential || undefined,
                reasonCode: reasonCode.trim() || undefined,
                internalNote: internalNote.trim() || undefined,
              })
            }
          >
            {busy ? dialogCopy.saving : actionLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
