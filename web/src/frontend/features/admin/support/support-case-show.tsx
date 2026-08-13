"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { Show, useRecordContext, useRefresh } from "react-admin";
import type { AdminSupportCaseDetail } from "@/shared/contracts/support";
import { useSupportInvalidation } from "@/frontend/features/support/client/use-support-invalidation";
import { handleSupportMessageKeyDown } from "@/frontend/features/support/components/support-message-keyboard";
import { adminDataProvider } from "../app/data-provider";

export function SupportCaseReview() {
  const record = useRecordContext<AdminSupportCaseDetail>();
  const refresh = useRefresh();
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState("");
  const [reason, setReason] = useState("STAFF_HANDOFF");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const recordId = record?.id;
  useSupportInvalidation(
    useCallback(
      (event) => {
        if (recordId && event.caseId === recordId) refresh();
      },
      [recordId, refresh],
    ),
  );
  useEffect(() => {
    const messages = messagesRef.current;
    if (messages) messages.scrollTop = messages.scrollHeight;
  }, [record?.id, record?.messages.length]);

  if (!record) return null;
  const currentRecord = record;

  async function command(
    action: string,
    body: Record<string, unknown> = { confirmation: true },
  ) {
    setBusy(true);
    setError(null);
    try {
      await adminDataProvider.command(
        `/api/admin/support-cases/${encodeURIComponent(currentRecord.id)}/${action}`,
        body,
        currentRecord.version,
        crypto.randomUUID(),
      );
      setReply("");
      setNote("");
      refresh();
    } catch (reasonValue) {
      setError(
        reasonValue instanceof Error
          ? reasonValue.message
          : "Support command failed.",
      );
      refresh();
    } finally {
      setBusy(false);
    }
  }

  function sendReply() {
    return command("reply", {
      content: reply,
      clientOperationId: crypto.randomUUID(),
    });
  }

  return (
    <Box sx={{ p: 3, display: "grid", gap: 2, maxWidth: 1100 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          gap: 2,
          alignItems: "start",
        }}
      >
        <Box>
          <Typography variant="overline" color="primary">
            SmartHire Support
          </Typography>
          <Typography component="h1" variant="h4">
            {record.subject}
          </Typography>
          <Typography color="text.secondary">
            Case {record.id} · {record.category.replaceAll("_", " ")}
          </Typography>
        </Box>
        <Box sx={{ display: "grid", justifyItems: "end", gap: 1 }}>
          <Chip label="Online" color="success" size="small" />
          <Typography
            sx={{
              px: 1.5,
              py: 0.75,
              borderRadius: 99,
              bgcolor: "grey.100",
              fontWeight: 700,
            }}
          >
            {record.state.replaceAll("_", " ")}
          </Typography>
        </Box>
      </Box>

      {error ? (
        <Alert severity="warning">{error}. The case was refreshed.</Alert>
      ) : null}
      <Alert severity="info">
        Support access does not grant access to ordinary user-to-user
        conversations.
      </Alert>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
        }}
      >
        <Box
          sx={{
            p: 2,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <Typography variant="h6">Requester</Typography>
          <Typography>{record.requesterDisplayName}</Typography>
          <Typography>{record.requesterMaskedEmail}</Typography>
          <Typography variant="body2" color="text.secondary">
            Account ID: {record.requesterUserId}
          </Typography>
        </Box>
        <Box
          sx={{
            p: 2,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <Typography variant="h6">Assignment</Typography>
          <Typography>
            {record.currentAssigneeUserId ?? "Unassigned"}
          </Typography>
          {!record.currentAssigneeUserId && record.state !== "CLOSED" ? (
            <Button disabled={busy} onClick={() => command("claim")}>
              Claim case
            </Button>
          ) : null}
          {record.currentAssigneeUserId && record.state !== "CLOSED" ? (
            <Box sx={{ display: "grid", gap: 1, mt: 1 }}>
              <TextField
                label="New administrator account ID"
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
              />
              <TextField
                select
                label="Reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                {[
                  "STAFF_HANDOFF",
                  "WORKLOAD_BALANCE",
                  "EXPERTISE_REQUIRED",
                ].map((value) => (
                  <MenuItem key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                disabled={busy || !assignee.trim()}
                onClick={() =>
                  command("reassign", { assigneeAdminUserId: assignee, reason })
                }
              >
                Reassign
              </Button>
            </Box>
          ) : null}
        </Box>
      </Box>

      <Divider />
      <Typography component="h2" variant="h5">
        Conversation
      </Typography>
      {!record.contentAvailable ? (
        <Alert severity="info">
          Content was deleted under the retention policy.
        </Alert>
      ) : (
        <Box
          ref={messagesRef}
          aria-label="Support conversation messages"
          sx={{
            display: "grid",
            gap: 1.5,
            minHeight: 240,
            maxHeight: "52vh",
            overflowY: "auto",
            overscrollBehavior: "contain",
            scrollbarGutter: "stable",
            pr: 1,
          }}
        >
          {record.messages.map((message) => (
            <Box
              key={message.id}
              sx={{
                justifySelf:
                  message.senderKind === "ADMINISTRATOR" ? "end" : "start",
                maxWidth: "78%",
                p: 1.5,
                borderRadius: 2,
                bgcolor:
                  message.senderKind === "ADMINISTRATOR"
                    ? "primary.main"
                    : "grey.100",
                color:
                  message.senderKind === "ADMINISTRATOR"
                    ? "primary.contrastText"
                    : "text.primary",
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 800 }}>
                {message.senderKind === "ADMINISTRATOR"
                  ? "SmartHire Support"
                  : record.requesterDisplayName}
              </Typography>
              <Typography
                sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              >
                {message.content}
              </Typography>
              <Typography variant="caption">
                {new Date(message.createdAt).toLocaleString()}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {record.currentAssigneeUserId &&
      record.state !== "CLOSED" &&
      record.contentAvailable ? (
        <Box sx={{ display: "grid", gap: 1 }}>
          <TextField
            label="Reply as SmartHire Support"
            multiline
            minRows={3}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            onKeyDown={(event) =>
              handleSupportMessageKeyDown(event, () => {
                if (!busy && reply.trim()) void sendReply();
              })
            }
            inputProps={{ maxLength: 4000 }}
            helperText="Enter to send; Shift+Enter for a new line"
          />
          <Button
            variant="contained"
            disabled={busy || !reply.trim()}
            onClick={() => void sendReply()}
          >
            Send reply
          </Button>
        </Box>
      ) : null}

      <Divider />
      <Typography component="h2" variant="h5">
        Internal notes
      </Typography>
      {record.notes.map((item) => (
        <Box
          key={item.id}
          sx={{
            p: 1.5,
            bgcolor: "warning.50",
            borderLeft: "4px solid",
            borderColor: "warning.main",
          }}
        >
          <Typography>{item.normalizedText}</Typography>
          <Typography variant="caption">
            {new Date(item.createdAt).toLocaleString()}
          </Typography>
        </Box>
      ))}
      {record.currentAssigneeUserId && record.state !== "CLOSED" ? (
        <Box sx={{ display: "grid", gap: 1 }}>
          <TextField
            label="Private internal note"
            multiline
            minRows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            inputProps={{ maxLength: 2000 }}
          />
          <Button
            disabled={busy || !note.trim()}
            onClick={() => command("note", { note })}
          >
            Add private note
          </Button>
        </Box>
      ) : null}

      {record.currentAssigneeUserId && record.state !== "CLOSED" ? (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {record.state !== "RESOLVED" ? (
            <Button
              variant="contained"
              color="success"
              disabled={busy}
              onClick={() => command("resolve")}
            >
              Resolve case
            </Button>
          ) : null}
          <Button
            color="error"
            disabled={busy}
            onClick={() => command("close")}
          >
            Close case
          </Button>
        </Box>
      ) : null}

      <Divider />
      <Typography component="h2" variant="h5">
        Assignment history
      </Typography>
      {record.assignments.map((item) => (
        <Typography key={item.id}>
          {item.assigneeAdminUserId} ·{" "}
          {new Date(item.assignedAt).toLocaleString()} ·{" "}
          {item.endReason ?? "ACTIVE"}
        </Typography>
      ))}
    </Box>
  );
}

export function SupportCaseShow() {
  return (
    <Show>
      <SupportCaseReview />
    </Show>
  );
}
