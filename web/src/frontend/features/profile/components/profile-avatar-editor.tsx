"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Check, CircleHelp, Info, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { profileAvatarResponseSchema } from "@/shared/contracts/account/profile-avatar";
import { Button } from "@/frontend/components/ui/button";
import { Modal } from "@/frontend/components/ui/modal";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { localizeAccountMessage } from "../client/localized-account-feedback";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/u)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "SH"
  );
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("AVATAR_IMAGE_INVALID"));
    image.src = source;
  });
}

async function cropAvatar(source: string) {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 384;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("AVATAR_CANVAS_UNAVAILABLE");

  const cropSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = (image.naturalWidth - cropSize) / 2;
  const sourceY = (image.naturalHeight - cropSize) / 2;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.beginPath();
  context.ellipse(192, 192, 184, 184, 0, 0, Math.PI * 2);
  context.clip();
  context.drawImage(
    image,
    sourceX,
    sourceY,
    cropSize,
    cropSize,
    0,
    0,
    384,
    384,
  );

  return canvas.toDataURL("image/png");
}

export function ProfileAvatarEditor({
  accountName,
  initialAvatar,
  csrfProof,
  onAvatarChanged,
  compact = false,
  open = false,
  onOpenChange,
}: {
  accountName: string;
  initialAvatar?: string | null;
  csrfProof: string;
  onAvatarChanged?: (image: string | null) => void;
  compact?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          kicker: "ẢNH ĐẠI DIỆN",
          title: "Giúp hồ sơ của bạn dễ nhận diện",
          description:
            "Chọn một ảnh rõ nét, SmartHire sẽ tự căn giữa trong khung tròn. Ảnh được lưu cùng tài khoản sau khi tải lại trang.",
          choose: "Chọn ảnh",
          another: "Chọn ảnh khác",
          save: "Lưu ảnh",
          saving: "Đang lưu…",
          remove: "Xóa ảnh",
          removeTitle: "Xóa ảnh đại diện?",
          removeDescription:
            "Ảnh đại diện hiện tại sẽ bị xóa khỏi tài khoản của bạn.",
          cancel: "Hủy",
          confirmRemove: "Xóa ảnh",
          help: "Tự động cắt chính giữa · PNG, JPEG hoặc WebP · tối đa 5 MB",
          invalid: "Chọn ảnh PNG, JPEG hoặc WebP có dung lượng tối đa 5 MB.",
          readError: "Không thể đọc ảnh đã chọn.",
          saveError: "Không thể lưu ảnh đại diện.",
          removeError: "Không thể xóa ảnh đại diện.",
          preview: `Xem trước ảnh đại diện của ${accountName}`,
        }
      : {
          kicker: "PROFILE PHOTO",
          title: "Make your profile recognizable",
          description:
            "Choose a clear photo and SmartHire will center it in a polished round frame. Save once and it stays with your account after refresh.",
          choose: "Choose photo",
          another: "Choose another photo",
          save: "Save photo",
          saving: "Saving…",
          remove: "Remove",
          removeTitle: "Remove profile photo?",
          removeDescription:
            "Your current profile photo will be removed from your account.",
          cancel: "Cancel",
          confirmRemove: "Remove photo",
          help: "Automatic centered crop · PNG, JPEG, or WebP · up to 5 MB",
          invalid: "Choose a PNG, JPEG, or WebP image up to 5 MB.",
          readError: "The selected image could not be read.",
          saveError: "The profile photo could not be saved.",
          removeError: "The profile photo could not be removed.",
          preview: `Preview of ${accountName}'s profile photo`,
        };
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState(initialAvatar ?? null);
  const [source, setSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">(
    "success",
  );
  const [removeConfirmationOpen, setRemoveConfirmationOpen] = useState(false);

  const preview = source ?? avatar;

  if (compact) {
    return (
      <Modal
        open={open}
        title={copy.title}
        description={copy.description}
        icon={<Info />}
        onClose={() => onOpenChange?.(false)}
      >
        <div className="candidate-avatar-modal">
          <ProfileAvatarEditor
            accountName={accountName}
            initialAvatar={avatar}
            csrfProof={csrfProof}
            onAvatarChanged={(image) => {
              setAvatar(image);
              onAvatarChanged?.(image);
            }}
          />
        </div>
      </Modal>
    );
  }

  function selectFile(file?: File) {
    setFeedback("");
    if (!file) return;
    if (!ACCEPTED_TYPES.has(file.type) || file.size > MAX_UPLOAD_BYTES) {
      setFeedbackTone("error");
      setFeedback(copy.invalid);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setSource(reader.result);
    };
    reader.onerror = () => {
      setFeedbackTone("error");
      setFeedback(copy.readError);
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    if (!source || busy) return;
    setBusy(true);
    setFeedback("");
    try {
      const image = await cropAvatar(source);
      const response = await fetch("/api/account/profile/avatar", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfProof,
        },
        body: JSON.stringify({ image }),
      });
      const body: unknown = await response.json();
      const parsed = profileAvatarResponseSchema.safeParse(body);
      if (!response.ok || !parsed.success) {
        const message =
          typeof body === "object" &&
          body !== null &&
          "message" in body &&
          typeof body.message === "string"
            ? localizeAccountMessage(locale, body.message)
            : copy.saveError;
        throw new Error(message);
      }
      setAvatar(parsed.data.image);
      onAvatarChanged?.(parsed.data.image);
      setSource(null);
      if (inputRef.current) inputRef.current.value = "";
      setFeedbackTone("success");
      const message = localizeAccountMessage(locale, parsed.data.message);
      setFeedback(message);
      toast.success(message, { id: "profile-avatar" });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : copy.saveError;
      setFeedbackTone("error");
      setFeedback(message);
      toast.error(message, { id: "profile-avatar" });
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch("/api/account/profile/avatar", {
        method: "DELETE",
        headers: { "X-CSRF-Token": csrfProof },
      });
      const body: unknown = await response.json();
      const parsed = profileAvatarResponseSchema.safeParse(body);
      if (!response.ok || !parsed.success) {
        throw new Error(copy.removeError);
      }
      setAvatar(null);
      onAvatarChanged?.(null);
      setSource(null);
      if (inputRef.current) inputRef.current.value = "";
      setFeedbackTone("success");
      const message = localizeAccountMessage(locale, parsed.data.message);
      setFeedback(message);
      toast.success(message, { id: "profile-avatar" });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : copy.removeError;
      setFeedbackTone("error");
      setFeedback(message);
      toast.error(message, { id: "profile-avatar" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="profile-avatar-section"
      className={`profile-avatar-panel${compact ? "profile-avatar-panel--compact" : ""}`}
      aria-labelledby="avatar-title"
    >
      <div className="profile-avatar-copy">
        <p className="panel-kicker">{copy.kicker}</p>
        <h2 id="avatar-title">{copy.title}</h2>
        <p>{copy.description}</p>
      </div>

      <div className="profile-avatar-editor">
        <div className="profile-avatar-preview-wrap">
          <div className="profile-avatar-preview">
            {preview ? (
              <Image
                src={preview}
                alt={copy.preview}
                width={384}
                height={384}
                unoptimized
              />
            ) : (
              <span aria-hidden="true">{initials(accountName)}</span>
            )}
          </div>
          <label
            className="profile-avatar-camera"
            htmlFor="profile-avatar-file"
            title={copy.choose}
          >
            <Camera aria-hidden="true" />
          </label>
        </div>

        <div className="profile-avatar-controls">
          <input
            ref={inputRef}
            id="profile-avatar-file"
            className="profile-avatar-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          <label
            className="profile-avatar-file-label"
            htmlFor="profile-avatar-file"
          >
            <UploadCloud aria-hidden="true" />
            <span>{preview ? copy.another : copy.choose}</span>
          </label>

          <div className="profile-avatar-actions">
            <button
              className="profile-avatar-save"
              type="button"
              disabled={!source || busy}
              onClick={() => void save()}
            >
              <Check aria-hidden="true" />
              <span>{busy ? copy.saving : copy.save}</span>
            </button>
            {avatar ? (
              <button
                className="profile-avatar-remove"
                type="button"
                disabled={busy}
                onClick={() => setRemoveConfirmationOpen(true)}
              >
                {copy.remove}
              </button>
            ) : null}
          </div>
          <p className="profile-avatar-help">
            <CircleHelp aria-hidden="true" />
            <span>{copy.help}</span>
          </p>
          <div
            className="profile-avatar-feedback"
            data-tone={feedbackTone}
            aria-live="polite"
          >
            {feedback ? <p role="status">{feedback}</p> : null}
          </div>
        </div>
      </div>
      <Modal
        open={removeConfirmationOpen}
        title={copy.removeTitle}
        description={copy.removeDescription}
        tone="destructive"
        busy={busy}
        onClose={() => setRemoveConfirmationOpen(false)}
      >
        <div className="sh-modal-actions">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setRemoveConfirmationOpen(false)}
          >
            {copy.cancel}
          </Button>
          <Button
            data-autofocus
            variant="danger"
            disabled={busy}
            onClick={() => {
              void remove().then((removed) => {
                if (removed) setRemoveConfirmationOpen(false);
              });
            }}
          >
            {busy ? copy.saving : copy.confirmRemove}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
