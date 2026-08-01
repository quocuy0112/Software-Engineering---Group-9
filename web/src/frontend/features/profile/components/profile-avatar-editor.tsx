"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { profileAvatarResponseSchema } from "@/shared/contracts/account/profile-avatar";

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
}: {
  accountName: string;
  initialAvatar?: string | null;
  csrfProof: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState(initialAvatar ?? null);
  const [source, setSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">(
    "success",
  );

  const preview = source ?? avatar;

  function selectFile(file?: File) {
    setFeedback("");
    if (!file) return;
    if (!ACCEPTED_TYPES.has(file.type) || file.size > MAX_UPLOAD_BYTES) {
      setFeedbackTone("error");
      setFeedback("Choose a PNG, JPEG, or WebP image up to 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setSource(reader.result);
    };
    reader.onerror = () => {
      setFeedbackTone("error");
      setFeedback("The selected image could not be read.");
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
            ? body.message
            : "The profile photo could not be saved.";
        throw new Error(message);
      }
      setAvatar(parsed.data.image);
      setSource(null);
      if (inputRef.current) inputRef.current.value = "";
      setFeedbackTone("success");
      setFeedback(parsed.data.message);
      toast.success(parsed.data.message, { id: "profile-avatar" });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "The profile photo could not be saved.";
      setFeedbackTone("error");
      setFeedback(message);
      toast.error(message, { id: "profile-avatar" });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
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
        throw new Error("The profile photo could not be removed.");
      }
      setAvatar(null);
      setSource(null);
      if (inputRef.current) inputRef.current.value = "";
      setFeedbackTone("success");
      setFeedback(parsed.data.message);
      toast.success(parsed.data.message, { id: "profile-avatar" });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The profile photo could not be removed.";
      setFeedbackTone("error");
      setFeedback(message);
      toast.error(message, { id: "profile-avatar" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="profile-avatar-panel" aria-labelledby="avatar-title">
      <div className="profile-avatar-copy">
        <p className="panel-kicker">PROFILE PHOTO</p>
        <h2 id="avatar-title">Make your profile recognizable</h2>
        <p>
          Choose a clear photo and SmartHire will center it in a polished round
          frame. Save once and it stays with your account after refresh.
        </p>
      </div>

      <div className="profile-avatar-editor">
        <div className="profile-avatar-preview">
          {preview ? (
            <Image
              src={preview}
              alt={`Preview of ${accountName}'s profile photo`}
              width={384}
              height={384}
              unoptimized
            />
          ) : (
            <span aria-hidden="true">{initials(accountName)}</span>
          )}
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
            {preview ? "Choose another photo" : "Choose photo"}
          </label>

          <div className="profile-avatar-actions">
            <button
              type="button"
              disabled={!source || busy}
              onClick={() => void save()}
            >
              {busy ? "Saving…" : "Save photo"}
            </button>
            {avatar ? (
              <button
                className="profile-avatar-remove"
                type="button"
                disabled={busy}
                onClick={() => void remove()}
              >
                Remove
              </button>
            ) : null}
          </div>
          <p className="profile-avatar-help">
            Automatic centered crop · PNG, JPEG, or WebP · up to 5 MB
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
    </section>
  );
}
