"use client";

import { useState } from "react";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  useDataProvider,
  useGetList,
  useNotify,
  useRefresh,
  useUpdate,
  useRedirect,
} from "react-admin";
import type { NotificationItem } from "@/shared/contracts/notifications";
import type { AdminDataProvider } from "../app/data-provider";

const visibleInterval = () =>
  typeof document === "undefined" || document.visibilityState === "visible"
    ? 4_000
    : false;

export function AdminNotificationButton() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const notify = useNotify();
  const redirect = useRedirect();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<AdminDataProvider>();
  const [update, updateState] = useUpdate<NotificationItem>();
  const notifications = useGetList<NotificationItem>(
    "notifications",
    {
      pagination: { page: 1, perPage: 8 },
      sort: { field: "lastOccurredAt", order: "DESC" },
      filter: { state: "all" },
    },
    { refetchInterval: visibleInterval },
  );
  const unreadCount = Number(notifications.meta?.unreadCount ?? 0);

  function openNotification(notification: NotificationItem) {
    const navigate = () => {
      setAnchor(null);
      if (notification.href) window.location.assign(notification.href);
    };
    if (notification.readAt) {
      navigate();
      return;
    }
    update(
      "notifications",
      {
        id: notification.id,
        data: { readAt: new Date().toISOString() },
        previousData: notification,
      },
      {
        mutationMode: "optimistic",
        onSettled: () => void notifications.refetch(),
        onError: () => notify("Unable to mark notification as read", { type: "error" }),
      },
    );
    navigate();
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await dataProvider.markAllNotificationsRead();
      notify("All notifications marked as read", { type: "success" });
      refresh();
      await notifications.refetch();
    } catch {
      notify("Unable to mark notifications as read", { type: "error" });
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          color="inherit"
          aria-label={`Notifications: ${unreadCount} unread`}
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsOutlinedIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{
          paper: { sx: { width: 380, maxWidth: "calc(100vw - 32px)" } },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", px: 2, py: 1 }}>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            Notifications
          </Typography>
          <Button
            size="small"
            startIcon={<DoneAllIcon />}
            disabled={unreadCount === 0 || markingAll}
            onClick={() => void markAllRead()}
          >
            Mark all read
          </Button>
        </Box>
        <Divider />
        {notifications.isPending ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
            <CircularProgress size={24} aria-label="Loading notifications" />
          </Box>
        ) : notifications.isError ? (
          <MenuItem onClick={() => void notifications.refetch()}>
            <ListItemText
              primary="Notifications unavailable"
              secondary="Select to retry"
            />
          </MenuItem>
        ) : notifications.data?.length ? (
          notifications.data.map((notification) => (
            <MenuItem
              key={notification.id}
              disabled={updateState.isPending}
              onClick={() => openNotification(notification)}
              sx={{ whiteSpace: "normal" }}
            >
              <ListItemText
                primary={notification.title}
                secondary={`${notification.category} · ${notification.summary}`}
                slotProps={{
                  primary: {
                    fontWeight: notification.readAt ? 400 : 700,
                  },
                  secondary: { noWrap: true },
                }}
              />
            </MenuItem>
          ))
        ) : (
          <MenuItem disabled>
            <ListItemText primary="No notifications" />
          </MenuItem>
        )}
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchor(null);
            redirect("list", "notifications");
          }}
        >
          <ListItemText primary="View all notifications" />
        </MenuItem>
      </Menu>
    </>
  );
}
