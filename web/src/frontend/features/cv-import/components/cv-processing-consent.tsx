"use client";

import { useRef, useState } from "react";

import {
  CV_EXTERNAL_CONSENT_TEXT_VERSION,
  type CvConsentGrantRequest,
  type CvConsentNotice,
} from "@/shared/contracts/cv-import/consent-retention";
import { CV_PROCESSING_NOTICES } from "@/shared/contracts/cv-import/upload";
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
  const heading = useRef<HTMLHeadingElement>(null);
  const activeAction = useRef<ConsentAction | null>(null);
  const [acceptance, setAcceptance] = useState({
    challenge: notice.consentChallenge,
    accepted: false,
  });
  const accepted =
    acceptance.challenge === notice.consentChallenge && acceptance.accepted;
  const [busy, setBusy] = useState<ConsentAction | null>(null);
  const [message, setMessage] = useState(
    notice.granted
      ? "External processing consent is active."
      : "External processing remains blocked until you explicitly grant consent.",
  );

  const grant = async () => {
    if (activeAction.current || !canGrant || !accepted || notice.granted)
      return;
    activeAction.current = "grant";
    setBusy("grant");
    setMessage("Granting external processing consent…");
    try {
      await onGrant({
        accepted: true,
        consentChallenge: notice.consentChallenge,
      });
      setAcceptance({
        challenge: notice.consentChallenge,
        accepted: false,
      });
      setMessage(
        "Consent granted. Approved external processing may now continue.",
      );
    } catch {
      setMessage(
        "Consent could not be granted. External processing remains blocked.",
      );
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
    setMessage("Revoking consent for future processing…");
    try {
      await onRevoke();
      setMessage("Consent revoked. Future external processing is blocked.");
    } catch {
      setMessage(
        "Consent could not be revoked. Refresh the status before continuing.",
      );
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
        External processing consent
      </h2>
      <dl className={styles.binding}>
        <div>
          <dt>Provider</dt>
          <dd>{notice.providerDisplayName}</dd>
        </div>
        <div>
          <dt>Purpose</dt>
          <dd>{notice.processingPurpose}</dd>
        </div>
        <div>
          <dt>Versions</dt>
          <dd>
            Consent {CV_EXTERNAL_CONSENT_TEXT_VERSION}; processing notice{" "}
            {CV_PROCESSING_NOTICES.EXTERNAL_OPENAI.noticeVersion}
          </dd>
        </div>
      </dl>

      {notice.granted ? (
        <div className={styles.granted}>
          <p>{notice.noticeText}</p>
          <button
            type="button"
            disabled={!canRevoke || Boolean(busy)}
            aria-busy={busy === "revoke"}
            onClick={() => void revoke()}
          >
            Revoke consent for future processing
          </button>
          {!canRevoke ? (
            <p className={styles.explanation}>
              No future external transmission is currently eligible for
              revocation.
            </p>
          ) : null}
        </div>
      ) : (
        <div className={styles.grant}>
          <label>
            <input
              type="checkbox"
              checked={accepted}
              disabled={!canGrant || Boolean(busy)}
              onChange={(event) =>
                setAcceptance({
                  challenge: notice.consentChallenge,
                  accepted: event.currentTarget.checked,
                })
              }
            />
            <span>{notice.noticeText}</span>
          </label>
          <button
            type="button"
            disabled={!canGrant || !accepted || Boolean(busy)}
            aria-busy={busy === "grant"}
            onClick={() => void grant()}
          >
            Grant external processing consent
          </button>
          {!canGrant ? (
            <p className={styles.explanation}>
              Consent is unavailable in the current import state. External
              processing stays blocked.
            </p>
          ) : null}
        </div>
      )}

      <p className={styles.caveat}>
        Revocation blocks future requests, but it cannot recall processing
        already transmitted to the approved provider.
      </p>
      <p
        className={styles.status}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {message}
      </p>
    </section>
  );
}
