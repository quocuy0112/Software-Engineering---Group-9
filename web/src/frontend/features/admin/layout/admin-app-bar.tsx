"use client";

import type { ComponentProps } from "react";
import { Box } from "@mui/material";
import { AppBar, TitlePortal } from "react-admin";
import { NotificationCenter } from "@/frontend/features/notifications/components/notification-center";
import { currentAdminCsrfToken } from "../app/auth-provider";

export function AdminAppBar(props: ComponentProps<typeof AppBar>) {
  return (
    <AppBar {...props}>
      <TitlePortal />
      <Box sx={{ flex: 1 }} />
      <NotificationCenter
        getCsrfProof={currentAdminCsrfToken}
        locale="en"
        viewAllHref="#/notifications"
      />
    </AppBar>
  );
}
