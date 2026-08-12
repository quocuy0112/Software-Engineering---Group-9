export function ConversationHeader({
  name,
  contextLabel,
  presence,
}: {
  name: string;
  contextLabel: string;
  presence: "ONLINE" | "OFFLINE";
}) {
  return (
    <div>
      <h2>{name}</h2>
      <p>{contextLabel}</p>
      <p aria-label={`${name} is ${presence === "ONLINE" ? "online" : "offline"}`}>
        <span aria-hidden="true">{presence === "ONLINE" ? "●" : "○"}</span>{" "}
        {presence === "ONLINE" ? "Online" : "Offline"}
      </p>
    </div>
  );
}
