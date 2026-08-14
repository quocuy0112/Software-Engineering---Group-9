"use client";

import type { ComponentProps } from "react";
import { Box } from "@mui/material";
import { AppBar, TitlePortal } from "react-admin";
import { AdminNotificationButton } from "../notifications/admin-notification-button";

export function AdminAppBar(props: ComponentProps<typeof AppBar>) {
  return (
    <AppBar {...props}>
      <TitlePortal />
      <Box sx={{ flex: 1 }} />
      <AdminNotificationButton />
    </AppBar>
  );
}
