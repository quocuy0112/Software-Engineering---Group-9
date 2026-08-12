import type { CSSProperties } from "react";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase())
    .join("");
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
  const style = image
    ? ({ "--messaging-avatar-image": `url(${JSON.stringify(image)})` } as CSSProperties)
    : undefined;

  return (
    <span
      className="messaging-avatar"
      data-size={size}
      data-has-image={Boolean(image)}
      style={style}
      aria-hidden="true"
    >
      {image ? null : initials(name)}
      {presence ? (
        <span className="messaging-avatar-presence" data-presence={presence.toLocaleLowerCase()} />
      ) : null}
    </span>
  );
}
