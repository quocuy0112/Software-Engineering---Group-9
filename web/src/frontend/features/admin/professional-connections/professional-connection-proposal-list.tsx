"use client";

import { useCallback, useState } from "react";
import {
  Alert,
  Box,
  Button,
  TextField as MuiTextField,
  Typography,
} from "@mui/material";
import {
  Datagrid,
  DateField,
  List,
  Pagination,
  SelectInput,
  TextField,
  TextInput,
  useRefresh,
} from "react-admin";
import { adminDataProvider } from "../app/data-provider";
import { useConnectionInvalidation } from "@/frontend/features/connections/client/use-connection-invalidation";

type AccountOption = {
  id: string;
  displayName: string;
  maskedEmail: string;
  state: string;
};

async function searchAccounts(query: string) {
  const params = new URLSearchParams({
    page: "1",
    perPage: "10",
    filter: JSON.stringify({ q: query, state: "ACTIVE" }),
  });
  const response = await fetch(`/api/admin/accounts?${params}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("ACCOUNT_SEARCH_FAILED");
  return (await response.json()).data as AccountOption[];
}

function AccountPicker({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: AccountOption | null;
  onSelect: (account: AccountOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<AccountOption[]>([]);
  const [busy, setBusy] = useState(false);
  async function search() {
    if (query.trim().length < 2) return;
    setBusy(true);
    try {
      setItems(await searchAccounts(query.trim()));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Typography fontWeight={700}>{label}</Typography>
      {selected ? (
        <Alert
          severity="success"
          action={<Button onClick={() => onSelect(null)}>Change</Button>}
        >
          <strong>{selected.displayName}</strong>
          <br />
          {selected.maskedEmail}
          <br />
          <small>{selected.id}</small>
        </Alert>
      ) : (
        <>
          <Box sx={{ display: "flex", gap: 1 }}>
            <MuiTextField
              fullWidth
              label="Name, exact email, or account ID"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void search();
                }
              }}
            />
            <Button
              variant="outlined"
              disabled={busy || query.trim().length < 2}
              onClick={() => void search()}
            >
              Search
            </Button>
          </Box>
          <Box sx={{ display: "grid", gap: 0.5 }}>
            {items.map((item) => (
              <Button
                key={item.id}
                variant="text"
                sx={{ justifyContent: "flex-start", textAlign: "left" }}
                onClick={() => onSelect(item)}
              >
                {item.displayName} · {item.maskedEmail} · {item.id}
              </Button>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}

function ProposalCreatePanel() {
  const refresh = useRefresh();
  const [first, setFirst] = useState<AccountOption | null>(null);
  const [second, setSecond] = useState<AccountOption | null>(null);
  const [reason, setReason] = useState("");
  const [expiryDays, setExpiryDays] = useState(7);
  const [supportCase, setSupportCase] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function create() {
    if (!first || !second) return;
    setBusy(true);
    setMessage(null);
    try {
      await adminDataProvider.command(
        "/api/admin/professional-connection-proposals",
        {
          participantAId: first.id,
          participantBId: second.id,
          reason,
          expiryDays,
          ...(supportCase.trim()
            ? { sourceSupportConversationId: supportCase.trim() }
            : {}),
        },
        1,
        crypto.randomUUID(),
      );
      setFirst(null);
      setSecond(null);
      setReason("");
      setSupportCase("");
      setMessage(
        "Proposal created. Both participants were notified; no connection exists until both accept.",
      );
      refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to create proposal.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Box
      sx={{
        mb: 3,
        p: 2.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        display: "grid",
        gap: 2,
      }}
    >
      <Box>
        <Typography variant="overline" color="primary">
          Bilateral consent
        </Typography>
        <Typography variant="h5">Propose a professional connection</Typography>
        <Typography color="text.secondary">
          Administrators can introduce accounts, but cannot force a connection
          or read their private messages.
        </Typography>
      </Box>
      {message ? (
        <Alert
          severity={
            message.startsWith("Proposal created") ? "success" : "warning"
          }
        >
          {message}
        </Alert>
      ) : null}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          gap: 2,
        }}
      >
        <AccountPicker
          label="First participant"
          selected={first}
          onSelect={setFirst}
        />
        <AccountPicker
          label="Second participant"
          selected={second}
          onSelect={setSecond}
        />
      </Box>
      <MuiTextField
        label="Reason shown to both participants"
        multiline
        minRows={2}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        inputProps={{ minLength: 10, maxLength: 500 }}
        helperText={`${reason.length}/500. Do not include sensitive support or private-message content.`}
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "180px 1fr" },
          gap: 2,
        }}
      >
        <MuiTextField
          label="Expiry (days)"
          type="number"
          value={expiryDays}
          onChange={(event) => setExpiryDays(Number(event.target.value))}
          inputProps={{ min: 1, max: 30 }}
        />
        <MuiTextField
          label="Optional Support case ID"
          value={supportCase}
          onChange={(event) => setSupportCase(event.target.value)}
        />
      </Box>
      <Button
        variant="contained"
        disabled={
          busy ||
          !first ||
          !second ||
          first.id === second.id ||
          reason.trim().length < 10 ||
          expiryDays < 1 ||
          expiryDays > 30
        }
        onClick={() => void create()}
      >
        {busy ? "Creating…" : "Send proposal to both people"}
      </Button>
    </Box>
  );
}

export function ProfessionalConnectionProposalList() {
  const refresh = useRefresh();
  useConnectionInvalidation(useCallback(() => refresh(), [refresh]));
  return (
    <List
      title="Professional Connection Proposals"
      perPage={25}
      empty={false}
      pagination={<Pagination rowsPerPageOptions={[25, 50, 100]} />}
      filters={[
        <SelectInput
          key="state"
          source="state"
          choices={[
            "PENDING_BOTH",
            "PARTIALLY_ACCEPTED",
            "ACCEPTED",
            "DECLINED",
            "EXPIRED",
            "CANCELLED",
          ].map((id) => ({ id, name: id.replaceAll("_", " ") }))}
        />,
        <TextInput
          key="participantId"
          source="participantId"
          label="Participant account ID"
        />,
        <TextInput
          key="creatorAdminUserId"
          source="creatorAdminUserId"
          label="Creator admin ID"
        />,
      ]}
    >
      <ProposalCreatePanel />
      <Datagrid
        bulkActionButtons={false}
        rowClick="show"
        empty={
          <Alert severity="info">
            No connection proposals yet. Use the form above to introduce two
            accounts.
          </Alert>
        }
      >
        <TextField source="id" label="Proposal" />
        <TextField
          source="participantLow.displayName"
          label="Participant A"
          emptyText="Deleted"
        />
        <TextField
          source="participantHigh.displayName"
          label="Participant B"
          emptyText="Deleted"
        />
        <TextField source="state" />
        <TextField source="version" />
        <DateField source="expiresAt" showTime />
        <DateField source="createdAt" showTime />
      </Datagrid>
    </List>
  );
}
