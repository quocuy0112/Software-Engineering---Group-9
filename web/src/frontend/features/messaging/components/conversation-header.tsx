import { MessagingAvatar } from "./messaging-avatar";

export function ConversationHeader({
  name,
  image,
  contextLabel,
  presence,
}: {
  name: string;
  image?: string | null;
  contextLabel: string;
  presence: "ONLINE" | "OFFLINE";
}) {
  return (
    <div className="messaging-participant-header">
      <MessagingAvatar name={name} image={image} size="large" presence={presence} />
      <div>
        <h2>{name}</h2>
        <p className="messaging-context-label">{contextLabel}</p>
        <p
          className="messaging-presence-label"
          data-presence={presence.toLocaleLowerCase()}
          aria-label={`${name} is ${presence === "ONLINE" ? "online" : "offline"}`}
        >
          <span aria-hidden="true" />
          {presence === "ONLINE" ? "Online now" : "Offline"}
        </p>
      </div>
    </div>
  );
}
