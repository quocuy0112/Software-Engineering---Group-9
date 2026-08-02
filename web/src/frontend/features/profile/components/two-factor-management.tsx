"use client";
import { useEffect, useState } from "react";
import { AuthStatus } from "@/frontend/features/authentication/components/auth-status";
import { PasswordField } from "@/frontend/features/authentication/components/password-field";
import { useReplayableStatus } from "@/frontend/features/authentication/components/use-status";
import { Button } from "@/frontend/components/ui/button";
import { Modal } from "@/frontend/components/ui/modal";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";

const MAX_TWO_FACTOR_MANAGEMENT_ATTEMPTS = 5;
const TWO_FACTOR_MANAGEMENT_ATTEMPTS_WINDOW_SECONDS = 10 * 60;
const TWO_FACTOR_MANAGEMENT_STORAGE_KEY_PREFIX =
  "smarthire-two-factor-management-attempts:";

type AttemptState = {
  count: number;
  lockedUntil?: number;
};

// The attempt counter must be scoped to the signed-in account, otherwise one
// account's failed attempts lock out every other account that shares the
// browser. We key on the session's CSRF proof (unique per authenticated
// session) rather than a single shared constant. Until the proof has loaded
// we don't have a safe key to read/write yet, so treat state as untracked.
function getStorageKey(sessionProof: string) {
  return `${TWO_FACTOR_MANAGEMENT_STORAGE_KEY_PREFIX}${sessionProof}`;
}

function readAttemptState(sessionProof: string) {
  if (typeof window === "undefined" || !sessionProof)
    return { count: 0 } as AttemptState;
  const storageKey = getStorageKey(sessionProof);
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return { count: 0 } as AttemptState;

  try {
    const parsed = JSON.parse(stored) as AttemptState;
    if (parsed.lockedUntil && parsed.lockedUntil > Date.now()) {
      return parsed;
    }
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
    ? `Có quá nhiều lần thử không thành công. Quy trình xác minh tạm khóa; hãy thử lại sau ${minutes} phút.`
    : `Too many failed attempts. This verification flow is temporarily locked. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

export function TwoFactorManagement({
  onDisabled,
}: {
  onDisabled?: () => void;
}) {
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          kicker: "KIỂM SOÁT KHÔI PHỤC",
          title: "Quản lý xác thực hai lớp",
          intro: "Tạo mã mới sẽ vô hiệu hóa toàn bộ mã dự phòng cũ.",
          password: "Mật khẩu hiện tại",
          code: "Mã TOTP gồm sáu chữ số",
          regenerate: "Tạo lại mã dự phòng",
          disable: "Tắt xác thực hai lớp",
          backupTitle: "Lưu mười mã dự phòng mới",
          saved: "Tôi đã lưu các mã này",
          disableTitle: "Tắt xác thực hai lớp?",
          replaceTitle: "Thay thế mã dự phòng?",
          disableCopy:
            "Tài khoản sẽ không còn yêu cầu mã xác thực khi đăng nhập.",
          replaceCopy:
            "Toàn bộ mã dự phòng hiện tại sẽ ngừng hoạt động ngay lập tức.",
          cancel: "Hủy",
          working: "Đang xử lý…",
          disableShort: "Tắt 2FA",
          regenerateShort: "Tạo lại mã",
          invalid: (remaining: number) =>
            `Mã xác minh không hợp lệ. (còn ${remaining} lần thử)`,
          generated: "Đã tạo mã dự phòng mới. Các mã cũ không còn hiệu lực.",
          disabled: "Đã tắt xác thực hai lớp.",
        }
      : {
          kicker: "RECOVERY CONTROLS",
          title: "Two-factor management",
          intro: "Regenerating codes invalidates every older backup code.",
          password: "Current password",
          code: "Six-digit TOTP code",
          regenerate: "Regenerate backup codes",
          disable: "Disable two-factor authentication",
          backupTitle: "Save your ten new backup codes",
          saved: "I saved these codes",
          disableTitle: "Disable two-factor authentication?",
          replaceTitle: "Replace backup codes?",
          disableCopy:
            "Your account will no longer require an authenticator code when signing in.",
          replaceCopy:
            "All existing backup codes will stop working immediately.",
          cancel: "Cancel",
          working: "Working…",
          disableShort: "Disable 2FA",
          regenerateShort: "Regenerate codes",
          invalid: (remaining: number) =>
            `That verification code is invalid. (${remaining} attempt${remaining === 1 ? "" : "s"} remaining)`,
          generated: "New backup codes generated. Older codes no longer work.",
          disabled: "Two-factor authentication disabled.",
        };
  const [proof, setProof] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [codes, setCodes] = useState<string[]>([]),
    { status, setStatus } = useReplayableStatus(""),
    [tone, setTone] = useState<"error" | "success">("success"),
    [busy, setBusy] = useState(false),
    [isLocked, setIsLocked] = useState(false),
    [confirmAction, setConfirmAction] = useState<
      "regenerate" | "disable" | null
    >(null);
  useEffect(() => {
    fetch("/api/identity/sessions", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => {
        const sessionProof = v?.csrfProof ?? "";
        setProof(sessionProof);
        const state = readAttemptState(sessionProof);
        if (state.lockedUntil && state.lockedUntil > Date.now()) {
          setIsLocked(true);
          setTone("error");
          setStatus(getLockedMessage(state.lockedUntil, locale));
        }
      });
    return () => {
      setCodes([]);
      setPassword("");
      setCode("");
    };
  }, [locale, setStatus]);
  useEffect(() => {
    if (codes.length === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [codes]);
  async function submit(path: string) {
    if (busy) return;

    const state = readAttemptState(proof);
    if (state.lockedUntil && state.lockedUntil > Date.now()) {
      setIsLocked(true);
      setTone("error");
      setStatus(getLockedMessage(state.lockedUntil, locale));
      return;
    }

    setBusy(true);
    setStatus("");
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": proof },
        body: JSON.stringify({ currentPassword: password, code }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) {
        const nextAttempts = (state.count ?? 0) + 1;
        const remainingAttempts =
          MAX_TWO_FACTOR_MANAGEMENT_ATTEMPTS - nextAttempts;
        const lockedUntil =
          nextAttempts >= MAX_TWO_FACTOR_MANAGEMENT_ATTEMPTS
            ? Date.now() + TWO_FACTOR_MANAGEMENT_ATTEMPTS_WINDOW_SECONDS * 1000
            : undefined;

        writeAttemptState(proof, nextAttempts, lockedUntil);
        setTone("error");
        if (lockedUntil) {
          setIsLocked(true);
          setStatus(getLockedMessage(lockedUntil, locale));
        } else {
          setIsLocked(false);
          setStatus(copy.invalid(remainingAttempts));
        }
        return;
      }
      writeAttemptState(proof, 0);
      setIsLocked(false);
      setTone("success");
      if (path.includes("regenerate")) {
        setCodes(b.backupCodes ?? []);
        setStatus(copy.generated);
      } else {
        setCodes([]);
        setStatus(copy.disabled);
        onDisabled?.();
      }
    } finally {
      setBusy(false);
      setPassword("");
      setCode("");
    }
  }
  return (
    <section
      className="security-panel security-panel--management"
      role="region"
      aria-labelledby="two-factor-management-title"
    >
      <div className="security-panel-heading">
        <span
          className="security-panel-icon security-panel-icon--success"
          aria-hidden="true"
        >
          ◎
        </span>
        <div>
          <p className="panel-kicker">{copy.kicker}</p>
          <h2 id="two-factor-management-title">{copy.title}</h2>
        </div>
      </div>
      <p className="security-panel-copy">{copy.intro}</p>
      <div className="security-management-fields">
        <PasswordField
          label={copy.password}
          id="management-password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="field">
          <label htmlFor="management-code">{copy.code}</label>
          <input
            id="management-code"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
          />
        </div>
      </div>
      <div className="security-actions">
        <button
          type="button"
          disabled={
            busy || isLocked || !proof || !password || code.length !== 6
          }
          onClick={() => setConfirmAction("regenerate")}
        >
          {copy.regenerate}
        </button>
        <button
          className="danger-action"
          type="button"
          disabled={
            busy || isLocked || !proof || !password || code.length !== 6
          }
          onClick={() => setConfirmAction("disable")}
        >
          {copy.disable}
        </button>
      </div>
      {codes.length > 0 ? (
        <div role="alert" aria-live="polite">
          <h3>{copy.backupTitle}</h3>
          <ul>
            {codes.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setCodes([])}>
            {copy.saved}
          </button>
        </div>
      ) : null}
      <AuthStatus status={status} tone={tone} />
      <Modal
        open={confirmAction !== null}
        title={
          confirmAction === "disable" ? copy.disableTitle : copy.replaceTitle
        }
        description={
          confirmAction === "disable" ? copy.disableCopy : copy.replaceCopy
        }
        tone={confirmAction === "disable" ? "destructive" : "standard"}
        busy={busy}
        onClose={() => setConfirmAction(null)}
      >
        <div className="sh-modal-actions">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setConfirmAction(null)}
          >
            {copy.cancel}
          </Button>
          <Button
            data-autofocus
            variant={confirmAction === "disable" ? "danger" : "primary"}
            disabled={busy}
            onClick={() => {
              const path =
                confirmAction === "disable"
                  ? "/api/identity/two-factor/disable"
                  : "/api/identity/two-factor/backup-codes/regenerate";
              void submit(path).then(() => setConfirmAction(null));
            }}
          >
            {busy
              ? copy.working
              : confirmAction === "disable"
                ? copy.disableShort
                : copy.regenerateShort}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
