"use client";

import type { CSSProperties } from "react";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase())
    .join("");
}

const avatarGradients = [
  "linear-gradient(135deg, #2563eb, #4f46e5)",
  "linear-gradient(135deg, #0f766e, #0891b2)",
  "linear-gradient(135deg, #4338ca, #7c3aed)",
  "linear-gradient(135deg, #0369a1, #2563eb)",
  "linear-gradient(135deg, #0f766e, #16a34a)",
];

function avatarGradient(name: string) {
  const seed = [...name].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return avatarGradients[seed % avatarGradients.length] ?? avatarGradients[0];
}

export function MessagingAvatar({
  name,
  image,
  size = "medium",
  presence,
}: {
  name: string;
  image?: string | null;
  size?: "small" | "medium" | "large";
  presence?: "ONLINE" | "OFFLINE";
}) {
  const style = {
    "--messaging-avatar-gradient": avatarGradient(name),
  } as CSSProperties;

  return (
    <span
      className="messaging-avatar"
      data-size={size}
      style={style}
      aria-hidden="true"
    >
      <span className="messaging-avatar-initials">{initials(name)}</span>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote avatars need a client-side image-error fallback.
        <img
          src={image}
          alt=""
          onError={(event) => {
            event.currentTarget.remove();
          }}
        />
      ) : null}
      {presence ? (
        <span
          className="messaging-avatar-presence"
          data-presence={presence.toLocaleLowerCase()}
        />
      ) : null}
    </span>
  );
}
