"use client";
import { useEffect, useState } from "react";
import { Alert, Box, CircularProgress, Typography } from "@mui/material";
import { useRedirect } from "react-admin";
import { adminDataProvider } from "../app/data-provider";
import { MetricCard } from "./metric-card";

type Snapshot = {
  calculatedAt: string;
  metrics: Record<string, { value: number; unit: string }>;
};
const labels: Record<string, string> = {
  candidateActive: "Active Candidate identities",
  candidateSuspended: "Suspended Candidate identities",
  candidatePending: "Pending Candidate identities",
  recruiterEnabledAccounts: "Recruiter-enabled accounts",
  ownerMemberships: "Active owners",
  hrManagerMemberships: "Active HR managers",
  recruiterMemberships: "Active recruiters",
  hiringManagerMemberships: "Active hiring managers",
  suspendedMemberships: "Suspended memberships",
  pendingVerificationRequests: "Pending verifications",
  pendingModerationReports: "Pending reports",
  securityNotificationsManualIntervention:
    "Security notifications requiring manual intervention",
};

export function AdminDashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [failed, setFailed] = useState(false);
  const redirect = useRedirect();
  useEffect(() => {
    void adminDataProvider
      .dashboard()
      .then((value) => setSnapshot(value as Snapshot))
      .catch(() => setFailed(true));
  }, []);
  if (failed)
    return (
      <Alert severity="error">
        Dashboard snapshot is unavailable. Retry after the next calculation
        cycle.
      </Alert>
    );
  if (!snapshot) return <CircularProgress aria-label="Loading dashboard" />;
  return (
    <Box sx={{ p: 3 }}>
      <Typography component="h1" variant="h4" gutterBottom>
        Platform administration
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Counts may be up to 60 seconds old.
      </Alert>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 2,
        }}
      >
        {Object.entries(snapshot.metrics).map(([key, metric]) => (
          <MetricCard
            key={key}
            label={labels[key] ?? key}
            {...metric}
            calculatedAt={snapshot.calculatedAt}
            onOpen={() => {
              const path =
                key === "securityNotificationsManualIntervention"
                  ? "/accounts?notificationStatus=MANUAL_INTERVENTION_REQUIRED"
                  : key.includes("Verification")
                    ? "/verification-requests"
                    : key.includes("Moderation")
                      ? "/moderation-reports"
                      : key.includes("Membership") || key.includes("members")
                        ? "/company-memberships"
                        : "/accounts";
              redirect(
                `${path}${path.includes("?") ? "&" : "?"}sourceCount=${metric.value}&sourceAt=${encodeURIComponent(snapshot.calculatedAt)}`,
              );
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
