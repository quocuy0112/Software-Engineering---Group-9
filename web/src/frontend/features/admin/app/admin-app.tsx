"use client";
import {
  Admin,
  List,
  Datagrid,
  TextField,
  Resource,
  memoryStore,
  CustomRoutes,
} from "react-admin";
import { Route } from "react-router-dom";
import { createTheme, ScopedCssBaseline } from "@mui/material";
import { adminAuthProvider } from "./auth-provider";
import { adminDataProvider } from "./data-provider";
import { createAdminQueryClient } from "./query-client";
import { AdminLayout } from "../layout/admin-layout";
import { AdminDashboard } from "../dashboard/admin-dashboard";
import { AccountList } from "../accounts/account-list";
import { AccountSecurityShow } from "../accounts/account-security-show";
import { AdminLoginPage } from "../auth/admin-login-page";
import { CompanyMembershipList } from "../memberships/company-membership-list";
import { MembershipLifecyclePanel } from "../memberships/membership-lifecycle-panel";
import { VerificationRequestList } from "../verification/verification-request-list";
import { VerificationReviewShow } from "../verification/verification-review-show";
import { ModerationReportList } from "../moderation/moderation-report-list";
import { ModerationReviewShow } from "../moderation/moderation-review-show";
import { MessagingReportList } from "../messaging-reports/messaging-report-list";
import { MessagingReportReviewShow } from "../messaging-reports/messaging-report-review-show";
import { SupportCaseList } from "../support/support-case-list";
import { SupportCaseShow } from "../support/support-case-show";
import { ProfessionalConnectionProposalList } from "../professional-connections/professional-connection-proposal-list";
import { ProfessionalConnectionProposalShow } from "../professional-connections/professional-connection-proposal-show";
import { AdminNotificationInbox } from "@/frontend/features/notifications/components/notification-inbox";
import { currentAdminCsrfToken } from "./auth-provider";

const theme = createTheme({
  palette: { mode: "light", primary: { main: "#155eef" } },
  components: {
    MuiInputBase: {
      styleOverrides: {
        input: {
          "&&:focus-visible": {
            outline: "none",
            outlineOffset: 0,
            boxShadow: "none",
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          "&&:focus-visible": {
            outline: "none",
            outlineOffset: 0,
            boxShadow: "none",
          },
        },
      },
    },
  },
});
const store = memoryStore();
const queryClient = createAdminQueryClient();

function SafeList() {
  return (
    <List perPage={25} pagination={false}>
      <Datagrid bulkActionButtons={false} rowClick="show">
        <TextField source="id" />
        <TextField source="displayName" />
        <TextField source="state" />
      </Datagrid>
    </List>
  );
}

export function AdminApp() {
  return (
    <ScopedCssBaseline enableColorScheme>
      <main id="admin-main">
        <Admin
          authProvider={adminAuthProvider}
          dataProvider={adminDataProvider}
          queryClient={queryClient}
          store={store}
          layout={AdminLayout}
          theme={theme}
          loginPage={AdminLoginPage}
          dashboard={AdminDashboard}
          requireAuth
        >
          <CustomRoutes>
            <Route
              path="/notifications"
              element={
                <AdminNotificationInbox
                  getCsrfProof={currentAdminCsrfToken}
                />
              }
            />
          </CustomRoutes>
          <Resource
            name="accounts"
            list={AccountList}
            show={AccountSecurityShow}
          />
          <Resource name="companies" list={SafeList} />
          <Resource
            name="company-memberships"
            list={CompanyMembershipList}
            show={MembershipLifecyclePanel}
          />
          <Resource
            name="verification-requests"
            list={VerificationRequestList}
            show={VerificationReviewShow}
          />
          <Resource
            name="moderation-reports"
            list={ModerationReportList}
            show={ModerationReviewShow}
          />
          <Resource
            name="messaging-reports"
            options={{ label: "Messaging Reports" }}
            list={MessagingReportList}
            show={MessagingReportReviewShow}
          />
          <Resource
            name="support-cases"
            list={SupportCaseList}
            show={SupportCaseShow}
          />
          <Resource
            name="professional-connection-proposals"
            options={{ label: "Connection Proposals" }}
            list={ProfessionalConnectionProposalList}
            show={ProfessionalConnectionProposalShow}
          />
        </Admin>
      </main>
    </ScopedCssBaseline>
  );
}
