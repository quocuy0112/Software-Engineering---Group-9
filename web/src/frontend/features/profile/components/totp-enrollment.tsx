"use client";
import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormFeedback } from "@/frontend/features/authentication/components/form-feedback";
import { PasswordField } from "@/frontend/features/authentication/components/password-field";
import { useReplayableStatus } from "@/frontend/features/authentication/components/use-status";
import {
  passwordProofSchema,
  totpCodeSchema,
  type PasswordProof,
  type TotpCode,
} from "@/shared/contracts/identity/two-factor";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { localizeAccountMessage } from "../client/localized-account-feedback";

// Must stay in sync with `rateLimitPolicies.totpEnrollment` in policies.ts.
const MAX_TOTP_ATTEMPTS = 5;
const TOTP_ATTEMPTS_WINDOW_SECONDS = 10 * 60;
const TOTP_ATTEMPTS_STORAGE_KEY_PREFIX = "smarthire-totp-attempts:";

type AttemptState = {
  count: number;
  lockedUntil?: number;
};

// The counter must be scoped to the signed-in account (via the session's
// CSRF proof), never to the password/code the person just typed — keying on
// the typed value meant a fresh wrong guess always reset the counter to a
// "new account", so lockouts either never triggered for a real attacker or,
// worse, got attributed to whatever text happened to be typed rather than
// to the account attempting enrollment.
function getStorageKey(sessionProof: string) {
  return `${TOTP_ATTEMPTS_STORAGE_KEY_PREFIX}${sessionProof}`;
}

function readAttemptState(sessionProof: string) {
  if (typeof window === "undefined" || !sessionProof)
    return { count: 0 } as AttemptState;
  const storageKey = getStorageKey(sessionProof);
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return { count: 0 } as AttemptState;
  try {
    const parsed = JSON.parse(stored) as AttemptState;
    if (parsed.lockedUntil && parsed.lockedUntil > Date.now()) return parsed;
    if (parsed.lockedUntil && parsed.lockedUntil <= Date.now()) {
      window.localStorage.removeItem(storageKey);
    }
    return { count: parsed.count ?? 0 } as AttemptState;
  } catch {
    window.localStorage.removeItem(storageKey);
    return { count: 0 } as AttemptState;
  }
}

function writeAttemptState(
  sessionProof: string,
  nextCount: number,
  lockedUntil?: number,
) {
  if (typeof window === "undefined" || !sessionProof) return;
  const storageKey = getStorageKey(sessionProof);
  if (nextCount <= 0) {
    window.localStorage.removeItem(storageKey);
    return;
  }
  window.localStorage.setItem(
    storageKey,
    JSON.stringify({ count: nextCount, lockedUntil }),
  );
}

function getLockedMessage(lockedUntil: number, locale: "vi" | "en") {
  const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
  return locale === "vi"
    ? `Có quá nhiều lần thử không thành công. Vui lòng chờ ${minutes} phút trước khi thử lại.`
    : `Too many failed attempts. Please wait ${minutes} minute${minutes === 1 ? "" : "s"} before trying again.`;
}

function currentTimestamp() {
  return Date.now();
}

type Setup = {
  qrCodeDataUrl: string;
  manualKey: string;
  issuer: string;
  accountLabel: string;
};
type Stage = "password" | "verify" | "complete";

/**
 * TOTP enrollment flow for the security settings page.
 *
 * Security posture: the QR data URL, manual key, and backup codes are held only
 * in transient React state. Nothing sensitive is written to localStorage,
 * sessionStorage, global stores, query caches, the URL, analytics, or logs, and
 * all sensitive state is cleared on completion, cancellation, and unmount.
 */
export function TotpEnrollment({ onEnabled }: { onEnabled?: () => void }) {
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          kicker: "KHUYẾN NGHỊ",
          title: "Thiết lập xác thực hai lớp",
          intro:
            "Xác nhận mật khẩu hiện tại để bắt đầu. Sau đó, bạn sẽ quét mã QR bằng ứng dụng xác thực.",
          password: "Mật khẩu hiện tại",
          starting: "Đang bắt đầu…",
          continue: "Tiếp tục",
          scan: "Quét mã QR này trong ứng dụng xác thực cho",
          qrAlt: "Mã QR để đăng ký ứng dụng xác thực hai lớp",
          manual: "Không thể quét? Nhập khóa thiết lập này theo cách thủ công:",
          code: "Mã gồm sáu chữ số",
          verifying: "Đang xác minh…",
          verify: "Xác minh và bật",
          cancel: "Hủy",
          backupTitle: "Lưu mã dự phòng",
          backupWarning:
            "Hãy lưu mười mã dự phòng này ở nơi an toàn ngay bây giờ. Chúng chỉ hiển thị một lần và mỗi mã chỉ dùng được một lần khi bạn mất ứng dụng xác thực.",
          saved: "Tôi đã lưu mã dự phòng",
          sessionExpired: "Phiên đã hết hạn. Hãy đăng nhập lại để tiếp tục.",
          proofExpired:
            "Xác thực bảo mật không còn hiệu lực. Hãy tải lại trang.",
          unavailable: "Tạm thời không thể thiết lập 2FA. Vui lòng thử lại.",
          passwordAttempt: (remaining: number) =>
            `Hãy xác nhận mật khẩu hiện tại để tiếp tục. (còn ${remaining} lần thử)`,
          codeAttempt: (remaining: number) =>
            `Không thể xác minh mã này. Hãy thử lại. (còn ${remaining} lần thử)`,
          enabled: "Đã bật xác thực hai lớp.",
          cancelled: "Đã hủy thiết lập.",
          dismissed: "Đã đóng danh sách mã dự phòng.",
        }
      : {
          kicker: "RECOMMENDED",
          title: "Set up two-factor authentication",
          intro:
            "Confirm your current password to begin. You will scan a QR code with your authenticator app.",
          password: "Current password",
          starting: "Starting…",
          continue: "Continue",
          scan: "Scan this QR code in your authenticator app for",
          qrAlt: "QR code for two-factor authenticator enrollment",
          manual: "Can't scan? Enter this setup key manually:",
          code: "Six-digit code",
          verifying: "Verifying…",
          verify: "Verify and enable",
          cancel: "Cancel",
          backupTitle: "Save your backup codes",
          backupWarning:
            "Store these ten backup codes somewhere safe now. They are shown only once and each can be used a single time if you lose your authenticator.",
          saved: "I've saved my backup codes",
          sessionExpired:
            "Your session has expired. Sign in again to continue.",
          proofExpired:
            "Your security proof is no longer valid. Reload the page.",
          unavailable:
            "Two-factor setup is temporarily unavailable. Please try again.",
          passwordAttempt: (remaining: number) =>
            `Please confirm your current password to continue. (${remaining} attempt${remaining === 1 ? "" : "s"} remaining)`,
          codeAttempt: (remaining: number) =>
            `That code could not be verified. Try again. (${remaining} attempt${remaining === 1 ? "" : "s"} remaining)`,
          enabled: "Two-factor authentication is now enabled.",
          cancelled: "Enrollment cancelled.",
          dismissed: "Backup codes dismissed.",
        };
  const [proof, setProof] = useState("");
  const [stage, setStage] = useState<Stage>("password");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const { status, setStatus } = useReplayableStatus("");
  const [statusTone, setStatusTone] = useState<"message" | "error" | "success">(
    "message",
  );
  const [isLocked, setIsLocked] = useState(false);

  const clearSensitive = useCallback(() => {
    setSetup(null);
    setBackupCodes([]);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/api/identity/sessions", {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) return;
          const body = (await response.json()) as { csrfProof: string };
          setProof(body.csrfProof);
          const state = readAttemptState(body.csrfProof);
          if (state.lockedUntil && state.lockedUntil > Date.now()) {
            setIsLocked(true);
            setStatusTone("error");
            setStatus(getLockedMessage(state.lockedUntil, locale));
          }
        } catch {
          // Navigation can abort this background request during route changes.
          return;
        }
      })();
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [locale, setStatus]);

  // Warn before navigating away while backup codes are still on screen.
  useEffect(() => {
    if (backupCodes.length === 0) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [backupCodes.length]);

  // Clear all sensitive state on unmount.
  useEffect(() => () => clearSensitive(), [clearSensitive]);

  const passwordForm = useForm<PasswordProof>({
    resolver: zodResolver(passwordProofSchema),
    defaultValues: { currentPassword: "" },
  });
  const codeForm = useForm<TotpCode>({
    resolver: zodResolver(totpCodeSchema),
    defaultValues: { code: "" },
  });

  const startEnrollment = passwordForm.handleSubmit(async (values) => {
    const state = readAttemptState(proof);
    if (state.lockedUntil && state.lockedUntil > currentTimestamp()) {
      setIsLocked(true);
      setStatusTone("error");
      setStatus(getLockedMessage(state.lockedUntil, locale));
      return;
    }
    setStatus("");
    const response = await fetch("/api/identity/two-factor/enrollment", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": proof },
      body: JSON.stringify(values),
    });
    const responseBody = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    passwordForm.reset({ currentPassword: "" });
    if (!response.ok) {
      setStatusTone("error");
      const passwordRejected =
        response.status === 401 &&
        responseBody?.message ===
          "Please confirm your current password to continue.";
      if (!passwordRejected) {
        writeAttemptState(proof, 0);
        setIsLocked(false);
        if (
          response.status === 401 &&
          responseBody?.message === "Authentication required."
        ) {
          setStatus(copy.sessionExpired);
        } else if (response.status === 403) {
          setStatus(copy.proofExpired);
        } else {
          setStatus(
            responseBody?.message
              ? localizeAccountMessage(locale, responseBody.message)
              : copy.unavailable,
          );
        }
        return;
      }
      const nextAttempts = (state.count ?? 0) + 1;
      const remaining = MAX_TOTP_ATTEMPTS - nextAttempts;
      const lockedUntil =
        nextAttempts >= MAX_TOTP_ATTEMPTS
          ? currentTimestamp() + TOTP_ATTEMPTS_WINDOW_SECONDS * 1000
          : undefined;
      writeAttemptState(proof, nextAttempts, lockedUntil);
      if (lockedUntil) {
        setIsLocked(true);
        setStatus(getLockedMessage(lockedUntil, locale));
      } else {
        setIsLocked(false);
        setStatus(copy.passwordAttempt(remaining));
      }
      return;
    }
    writeAttemptState(proof, 0);
    setIsLocked(false);
    setSetup(responseBody as Setup);
    setStage("verify");
  });

  const verifyCode = codeForm.handleSubmit(async (values) => {
    const state = readAttemptState(proof);
    if (state.lockedUntil && state.lockedUntil > currentTimestamp()) {
      setIsLocked(true);
      setStatusTone("error");
      setStatus(getLockedMessage(state.lockedUntil, locale));
      return;
    }
    setStatus("");
    const response = await fetch("/api/identity/two-factor/enrollment/verify", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": proof },
      body: JSON.stringify(values),
    });
    codeForm.reset({ code: "" });
    if (!response.ok) {
      setStatusTone("error");
      const nextAttempts = (state.count ?? 0) + 1;
      const remaining = MAX_TOTP_ATTEMPTS - nextAttempts;
      const lockedUntil =
        nextAttempts >= MAX_TOTP_ATTEMPTS
          ? currentTimestamp() + TOTP_ATTEMPTS_WINDOW_SECONDS * 1000
          : undefined;
      writeAttemptState(proof, nextAttempts, lockedUntil);
      if (lockedUntil) {
        setIsLocked(true);
        setStatus(getLockedMessage(lockedUntil, locale));
      } else {
        setIsLocked(false);
        setStatus(copy.codeAttempt(remaining));
      }
      return;
    }
    writeAttemptState(proof, 0);
    setIsLocked(false);
    const body = (await response.json()) as { backupCodes: string[] };
    setSetup(null);
    setBackupCodes(body.backupCodes);
    setStage("complete");
    setStatusTone("success");
    setStatus(copy.enabled);
  });

  function cancel() {
    clearSensitive();
    passwordForm.reset({ currentPassword: "" });
    codeForm.reset({ code: "" });
    setStage("password");
    setStatusTone("message");
    setStatus(copy.cancelled);
  }

  return (
    <section
      className="totp-enrollment security-panel"
      aria-labelledby="totp-title"
    >
      <div className="security-panel-heading">
        <span className="security-panel-icon" aria-hidden="true">
          <ShieldCheck size={20} />
        </span>
        <div>
          <p className="panel-kicker">{copy.kicker}</p>
          <h2 id="totp-title">{copy.title}</h2>
        </div>
      </div>

      {stage === "password" ? (
        <form
          onSubmit={startEnrollment}
          noValidate
          aria-busy={passwordForm.formState.isSubmitting}
        >
          <p>{copy.intro}</p>
          <PasswordField
            label={copy.password}
            autoComplete="current-password"
            error={passwordForm.formState.errors.currentPassword?.message}
            {...passwordForm.register("currentPassword")}
          />
          <button
            type="submit"
            disabled={passwordForm.formState.isSubmitting || !proof || isLocked}
          >
            {passwordForm.formState.isSubmitting
              ? copy.starting
              : copy.continue}
          </button>
          <FormFeedback status={status} tone={statusTone} />
        </form>
      ) : null}

      {stage === "verify" && setup ? (
        <form
          onSubmit={verifyCode}
          noValidate
          aria-busy={codeForm.formState.isSubmitting}
        >
          <p>
            {copy.scan} <strong>{setup.issuer}</strong> ({setup.accountLabel}).
          </p>
          {/* Base64 data-URL QR rendered server-side; next/image cannot optimize a data URI. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={setup.qrCodeDataUrl}
            alt={copy.qrAlt}
            className="totp-qr"
            width={240}
            height={240}
          />
          <p className="totp-manual">
            {copy.manual}
            <br />
            <code>{setup.manualKey}</code>
          </p>
          <div className="field">
            <label htmlFor="totp-code">{copy.code}</label>
            <input
              id="totp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              aria-invalid={Boolean(codeForm.formState.errors.code)}
              {...codeForm.register("code")}
            />
            {codeForm.formState.errors.code ? (
              <p role="alert">{codeForm.formState.errors.code.message}</p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={codeForm.formState.isSubmitting || isLocked}
          >
            {codeForm.formState.isSubmitting ? copy.verifying : copy.verify}
          </button>
          <button type="button" className="secondary-action" onClick={cancel}>
            {copy.cancel}
          </button>
          <FormFeedback status={status} tone={statusTone} />
        </form>
      ) : null}

      {stage === "complete" && backupCodes.length > 0 ? (
        <div aria-labelledby="backup-title">
          <h2 id="backup-title">{copy.backupTitle}</h2>
          <p role="alert" data-warning>
            {copy.backupWarning}
          </p>
          <ul className="backup-codes">
            {backupCodes.map((code) => (
              <li key={code}>
                <code>{code}</code>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              clearSensitive();
              setStage("password");
              setStatusTone("success");
              setStatus(copy.dismissed);
              onEnabled?.();
            }}
          >
            {copy.saved}
          </button>
          <FormFeedback status={status} tone={statusTone} />
        </div>
      ) : null}
    </section>
  );
}
