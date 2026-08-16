"use client";

import DoneAllIcon from "@mui/icons-material/DoneAll";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  Button,
  Datagrid,
  DateField,
  List,
  Pagination,
  SelectInput,
  TextField,
  TopToolbar,
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
  useUpdate,
} from "react-admin";
import type { NotificationItem } from "@/shared/contracts/notifications";
import type { AdminDataProvider } from "../app/data-provider";

const filters = [
  <SelectInput
    key="state"
    source="state"
    label="Read state"
    alwaysOn
    choices={[
      { id: "all", name: "All" },
      { id: "unread", name: "Unread" },
      { id: "read", name: "Read" },
    ]}
  />,
  <SelectInput
    key="category"
    source="category"
    choices={[
      "SECURITY",
      "ACCOUNT",
      "MEMBERSHIP",
      "APPLICATION",
      "VERIFICATION",
      "SUPPORT",
      "CONNECTION",
      "MESSAGING",
      "MODERATION",
      "SYSTEM",
    ].map((id) => ({ id, name: id }))}
  />,
];

function MarkAllReadButton() {
  const dataProvider = useDataProvider<AdminDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();

  async function markAllRead() {
    try {
      await dataProvider.markAllNotificationsRead();
      notify("All notifications marked as read", { type: "success" });
      refresh();
    } catch {
      notify("Unable to mark notifications as read", { type: "error" });
    }
  }

  return (
    <Button label="Mark all read" onClick={() => void markAllRead()}>
      <DoneAllIcon />
    </Button>
  );
}

function AdminNotificationListActions() {
  return (
    <TopToolbar>
      <MarkAllReadButton />
    </TopToolbar>
  );
}

function AdminNotificationOpenButton() {
  const notification = useRecordContext<NotificationItem>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [update, { isPending }] = useUpdate<NotificationItem>();
  if (!notification) return null;
  const current = notification;

  function navigate() {
    if (current.href) window.location.assign(current.href);
  }

  function open() {
    if (current.readAt) {
      navigate();
      return;
    }
    update(
      "notifications",
      {
        id: current.id,
        data: { readAt: new Date().toISOString() },
        previousData: current,
      },
      {
        mutationMode: "optimistic",
        onSettled: () => refresh(),
        onError: () =>
          notify("Unable to mark notification as read", { type: "error" }),
      },
    );
    navigate();
  }

  return (
    <Button
      label={current.href ? "Open" : current.readAt ? "Read" : "Mark read"}
      disabled={isPending || (Boolean(current.readAt) && !current.href)}
      onClick={open}
    >
      <OpenInNewIcon />
    </Button>
  );
}

export function AdminNotificationList() {
  return (
    <List
      title="Notifications"
      filters={filters}
      filterDefaultValues={{ state: "all" }}
      actions={<AdminNotificationListActions />}
      perPage={25}
      pagination={<Pagination rowsPerPageOptions={[25, 50, 100]} />}
      sort={{ field: "lastOccurredAt", order: "DESC" }}
    >
      <Datagrid bulkActionButtons={false} rowClick={false}>
        <TextField source="severity" />
        <TextField source="category" />
        <TextField source="title" />
        <TextField source="summary" />
        <DateField source="lastOccurredAt" label="Occurred" showTime />
        <DateField
          source="readAt"
          label="Read at"
          showTime
          emptyText="Unread"
        />
        <AdminNotificationOpenButton />
      </Datagrid>
    </List>
  );
}
