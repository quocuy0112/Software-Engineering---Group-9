"use client";
import { Layout, type LayoutProps } from "react-admin";
import { Box } from "@mui/material";
import { AdminAuthorityGate } from "../auth/admin-authority-gate";
import { AdminAppBar } from "./admin-app-bar";

export function AdminLayout(props: LayoutProps) {
  return (
    <AdminAuthorityGate>
      <Box
        id="admin-console-root"
        sx={{
          "& :focus-visible:not(.MuiInputBase-input):not(.MuiSelect-select)": {
            outline: "3px solid #155eef",
            outlineOffset: 2,
          },
        }}
      >
        <a href="#admin-main" style={{ position: "absolute", left: -10000 }}>
          Skip to administration content
        </a>
        <Layout {...props} appBar={AdminAppBar} />
      </Box>
    </AdminAuthorityGate>
  );
}
