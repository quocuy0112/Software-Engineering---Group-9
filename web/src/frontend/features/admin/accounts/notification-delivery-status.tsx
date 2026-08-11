"use client";
import { Alert, List, ListItem, ListItemText } from "@mui/material";
export function NotificationDeliveryStatus({
  notifications,
}: {
  notifications: Array<{
    id: string;
    status: string;
    kind: string;
    lastAttemptAt: string | null;
    nextAttemptAt: string | null;
    failureCategory: string | null;
  }>;
}) {
  if (!notifications.length)
    return (
      <Alert severity="info">
        No access-security notifications are associated with this account.
      </Alert>
    );
  return (
    <List aria-label="Security notification delivery status">
      {notifications.map((item) => (
        <ListItem key={item.id}>
          <ListItemText
            primary={`${item.kind}: ${item.status}`}
            secondary={`Last attempt: ${item.lastAttemptAt ?? "not attempted"}; next attempt: ${item.nextAttemptAt ?? "none"}; failure: ${item.failureCategory ?? "none"}`}
          />
        </ListItem>
      ))}
    </List>
  );
}
