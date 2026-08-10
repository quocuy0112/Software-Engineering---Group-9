"use client";

import { useRef, useState } from "react";

import {
  CV_EXTERNAL_CONSENT_TEXT_VERSION,
  type CvConsentGrantRequest,
  type CvConsentNotice,
} from "@/shared/contracts/cv-import/consent-retention";
import { CV_PROCESSING_NOTICES } from "@/shared/contracts/cv-import/upload";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { cvCopy, cvProcessingNoticeText } from "../i18n/cv-import-copy";
import styles from "./cv-processing-consent.module.css";

type ConsentAction = "grant" | "revoke";

export function CvProcessingConsent({
  notice,
  canGrant,
  canRevoke,
  onGrant,
  onRevoke,
}: {
  notice: CvConsentNotice;
  canGrant: boolean;
  canRevoke: boolean;
  onGrant: (request: CvConsentGrantRequest) => Promise<void>;
  onRevoke: () => Promise<void>;
}) {
  const locale = useWorkspaceLocale();
  const copy = cvCopy(locale).consent;
  const noticeText = cvProcessingNoticeText(locale, "EXTERNAL_OPENAI");
  const heading = useRef<HTMLHeadingElement>(null);
  const activeAction = useRef<ConsentAction | null>(null);
  // Status polling refreshes the short-lived signed challenge. That refresh
  // must not undo the Candidate's visible checkbox choice; grant() still sends
  // the newest challenge received from the server.
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState<ConsentAction | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<
    "neutral" | "pending" | "success" | "error"
  >(notice.granted ? "success" : "neutral");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [message, setMessage] = useState(
    notice.granted ? copy.grantedActive : copy.blocked,
  );

  const grant = async () => {
    if (activeAction.current || !canGrant || !accepted || notice.granted)
      return;
    activeAction.current = "grant";
    setBusy("grant");
    setFeedbackTone("pending");
    setMessage(copy.granting);
    try {
      await onGrant({
        accepted: true,
        consentChallenge: notice.consentChallenge,
      });

      setAccepted(false);
      setMessage(copy.granted);
      setFeedbackTone("success");
    } catch (cause) {
      const expired =
        cause instanceof Error && cause.message === "CV_SESSION_EXPIRED";
      setSessionExpired(expired);
      setMessage(expired ? copy.expired : copy.grantError);
      setFeedbackTone("error");
      heading.current?.focus();
    } finally {
      activeAction.current = null;
      setBusy(null);
    }
  };

  const revoke = async () => {
    if (activeAction.current || !canRevoke || !notice.granted) return;
    activeAction.current = "revoke";
    setBusy("revoke");
    setFeedbackTone("pending");
    setMessage(copy.revoking);
    try {
      await onRevoke();
      setMessage(copy.revoked);
      setFeedbackTone("success");
    } catch (cause) {
      const expired =
        cause instanceof Error && cause.message === "CV_SESSION_EXPIRED";
      setSessionExpired(expired);
      setMessage(expired ? copy.expired : copy.revokeError);
      setFeedbackTone("error");
      heading.current?.focus();
    } finally {
      activeAction.current = null;
      setBusy(null);
    }
  };

  return (
    <section
      className={styles.root}
      data-testid="cv-processing-consent"
      data-narrow-layout="320"
      data-reduced-motion-safe="true"
      aria-labelledby="cv-processing-consent-heading"
    >
      <h2 id="cv-processing-consent-heading" ref={heading} tabIndex={-1}>
        {copy.heading}
      </h2>
      <dl className={styles.binding}>
        <div>
          <dt>{copy.provider}</dt>
          <dd>{notice.providerDisplayName}</dd>
        </div>
        <div>
          <dt>{copy.purpose}</dt>
          <dd>
            {locale === "vi"
              ? "Tạo bản nháp xem xét CV riêng bằng cách trích xuất dữ kiện nghề nghiệp"
              : notice.processingPurpose}
          </dd>
        </div>
      </dl>
      <details className={styles.technicalDetails}>
        <summary>
          {locale === "vi"
            ? "Chi tiết kỹ thuật và phiên bản"
            : "Technical and version details"}
        </summary>
        <dl>
          <div>
            <dt>{copy.versions}</dt>
            <dd>
              {locale === "vi" ? "Đồng ý" : "Consent"}{" "}
              {CV_EXTERNAL_CONSENT_TEXT_VERSION};{" "}
              {locale === "vi" ? "thông báo xử lý" : "processing notice"}{" "}
              {CV_PROCESSING_NOTICES.EXTERNAL_OPENAI.noticeVersion}
            </dd>
          </div>
        </dl>
      </details>

      {notice.granted ? (
        <div className={styles.granted}>
          <p>{noticeText || notice.noticeText}</p>
          <button
            className={styles.revokeButton}
            type="button"
            disabled={!canRevoke || Boolean(busy) || sessionExpired}
            aria-busy={busy === "revoke"}
            onClick={() => void revoke()}
          >
            {busy === "revoke"
              ? copy.revoking
              : locale === "vi"
                ? "Thu hồi quyền xử lý trong tương lai"
                : "Revoke consent for future processing"}
          </button>
          {!canRevoke ? (
            <p className={styles.explanation}>{copy.noRevocation}</p>
          ) : null}
        </div>
      ) : (
        <div className={styles.grant}>
          <label>
            <input
              type="checkbox"
              checked={accepted}
              disabled={!canGrant || Boolean(busy) || sessionExpired}
              onChange={(event) => setAccepted(event.currentTarget.checked)}
            />
            <span>{locale === "vi" ? copy.agree : notice.noticeText}</span>
          </label>
          <button
            className={styles.grantButton}
            type="button"
            disabled={!canGrant || !accepted || Boolean(busy) || sessionExpired}
            aria-busy={busy === "grant"}
            onClick={() => void grant()}
          >
            {busy === "grant"
              ? copy.granting
              : locale === "vi"
                ? "Cấp quyền xử lý bên ngoài"
                : "Grant external processing consent"}
          </button>
          {!canGrant ? (
            <p className={styles.explanation}>{copy.unavailable}</p>
          ) : null}
        </div>
      )}

      <p className={styles.caveat}>{copy.caveat}</p>
      <p
        className={styles.status}
        data-tone={feedbackTone}
        role={feedbackTone === "error" ? "alert" : "status"}
        aria-live={feedbackTone === "error" ? "assertive" : "polite"}
        aria-atomic="true"
      >
        {message}
      </p>
    </section>
  );
}
