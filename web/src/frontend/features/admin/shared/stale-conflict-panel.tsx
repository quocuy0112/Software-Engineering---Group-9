"use client";
import { Alert, Button } from "@mui/material";
export function StaleConflictPanel({ onRefresh }: { onRefresh: () => void }) {
  return (
    <Alert
      severity="warning"
      action={<Button onClick={onRefresh}>Refresh current state</Button>}
    >
      The target changed before this command committed. Review the current state
      before trying again.
    </Alert>
  );
}
