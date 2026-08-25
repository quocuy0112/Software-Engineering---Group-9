"use client";

import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { Show, useRecordContext, useRefresh } from "react-admin";
import { ProtectedEvidenceViewer } from "../verification/protected-evidence-viewer";
import { AccountModerationPanel } from "./account-moderation-panel";
import { adminReasonLabel } from "../shared/admin-reason-label";

type CountProjection =
  | { kind: "CANDIDATE"; cvCount: number; applicationCount: number }
  | {
      kind: "RECRUITER";
      active: number;
      pendingReview: number;
      rejected: number;
      draft: number;
      closed: number;
    }
  | { kind: "CANDIDATE" | "RECRUITER"; unavailable: true };

type AccountDetail = {
  account: {
    id: string;
    accountReference: string;
    displayName: string;
    maskedEmail: string;
    registeredAt: string;
    type: "CANDIDATE" | "RECRUITER";
    status: "ACTIVE" | "SUSPENDED";
    version: number;
    counts: CountProjection;
  };
  candidateActivity: CountProjection | null;
  recruiterActivity: CountProjection | null;
  authorities: Array<{
    companyId: string;
    companyName: string;
    membershipRole: string;
    membershipState: string;
    verificationState: string;
  }>;
  approvedVerificationEvidence: Array<{
    requestId: string;
    evidenceId: string;
    companyName: string;
    taxIdentifier: string;
    submittedAt: string;
    approvedAt: string | null;
    version: number;
    fileName: string;
    mediaType: "image/png" | "image/jpeg" | "application/pdf";
    byteSize: number;
    safetyState: "PENDING" | "PASS" | "FAIL" | "ERROR";
    accessibility: "AVAILABLE" | "INACCESSIBLE" | "DELETED";
    unavailabilityReason:
      | "DELETED"
      | "CONTENT_RESTRICTED"
      | "SUPERSEDED"
      | "NOT_CURRENT_SUBMISSION"
      | "SAFETY_CHECK_INCOMPLETE"
      | "TARGET_COMPANY_INACTIVE"
      | null;
  }>;
  moderation: {
    canSuspend: boolean;
    canRestore: boolean;
    protectedAdministrator: boolean;
    reasonCode: string | null;
  };
  history: Array<{
    id: string;
    action: string;
    actorRef: string;
    priorState: string;
    resultingState: string;
    category: string;
    result: string;
    occurredAt: string;
    correlationId: string;
  }>;
  calculatedAt: string;
};

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 0.25 }}
      >
        {label}
      </Typography>
      <Typography variant="body2">{children}</Typography>
    </Box>
  );
}

function Count({
  value,
  label,
}: {
  value: CountProjection | null;
  label: string;
}) {
  if (!value) return null;
  if ("unavailable" in value) {
    return (
      <Alert severity="warning">
        {label} is temporarily unavailable. Refresh to confirm.
      </Alert>
    );
  }

  const items =
    value.kind === "CANDIDATE"
      ? [
          ["CVs", value.cvCount],
          ["Submitted applications", value.applicationCount],
        ]
      : [
          ["Active", value.active],
          ["Pending review", value.pendingReview],
          ["Rejected", value.rejected],
          ["Draft", value.draft],
          ["Closed", value.closed],
        ];

  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))",
        gap: 1,
      }}
    >
      {items.map(([name, count]) => (
        <Box
          key={name}
          component="div"
          sx={{ borderRadius: 1.5, bgcolor: "action.hover", px: 1.25, py: 1 }}
        >
          <Typography component="dt" variant="caption" color="text.secondary">
            {name}
          </Typography>
          <Typography
            component="dd"
            variant="h6"
            sx={{ m: 0, fontWeight: 700 }}
          >
            {count}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function Section({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <Paper
      component="section"
      aria-labelledby={id}
      variant="outlined"
      sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}
    >
      <Stack spacing={1.75}>
        <Typography id={id} component="h2" variant="h6">
          {title}
        </Typography>
        {children}
      </Stack>
    </Paper>
  );
}

function Content() {
  const record = useRecordContext<AccountDetail>();
  const refresh = useRefresh();
  if (!record) return null;
  const { account } = record;
  const registeredAt = new Date(account.registeredAt).toLocaleString();

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 1200,
        mx: "auto",
        p: { xs: 1, sm: 2 },
        display: "grid",
        gap: 2.5,
      }}
    >
      <Paper
        component="header"
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          background:
            "linear-gradient(135deg, rgba(25, 118, 210, 0.10), transparent 60%)",
        }}
      >
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "flex-start" }}
            spacing={1.5}
          >
            <Box>
              <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>
                {account.displayName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Account administration overview
              </Typography>
            </Box>
            <Button
              variant="outlined"
              onClick={() => refresh()}
              sx={{ alignSelf: { xs: "flex-start", sm: "auto" } }}
            >
              Refresh
            </Button>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              label={account.type === "RECRUITER" ? "Recruiter" : "Candidate"}
              color="primary"
              variant="outlined"
            />
            <Chip
              label={account.status === "SUSPENDED" ? "Suspended" : "Active"}
              color={account.status === "SUSPENDED" ? "warning" : "success"}
            />
          </Stack>
          <Divider />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(3, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            <Detail label="Account reference">
              {account.accountReference}
            </Detail>
            <Detail label="Masked email">{account.maskedEmail}</Detail>
            <Detail label="Registered">{registeredAt}</Detail>
          </Box>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            lg: "minmax(0, 1.45fr) minmax(300px, 0.85fr)",
          },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        <Stack spacing={2.5}>
          <Section id="candidate-activity-heading" title="Candidate activity">
            <Count value={record.candidateActivity} label="Candidate records" />
          </Section>
          {record.recruiterActivity && (
            <Section id="recruiter-activity-heading" title="Recruiter activity">
              <Count
                value={record.recruiterActivity}
                label="Job-posting activity"
              />
            </Section>
          )}
          {record.authorities.length > 0 && (
            <Section id="authority-heading" title="Company authority">
              <Stack spacing={1} divider={<Divider flexItem />}>
                {record.authorities.map((authority) => (
                  <Box
                    key={authority.companyId}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "minmax(0, 1fr) auto",
                      },
                      gap: 1,
                      alignItems: "center",
                    }}
                  >
                    <Box>
                      <Typography fontWeight={600}>
                        {authority.companyName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {authority.membershipRole} membership
                      </Typography>
                    </Box>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Chip
                        size="small"
                        label={authority.membershipState}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={authority.verificationState}
                        color={
                          authority.verificationState === "APPROVED"
                            ? "success"
                            : "default"
                        }
                      />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Section>
          )}
          <Section
            id="approved-verification-evidence-heading"
            title="Approved verification evidence"
          >
            {record.approvedVerificationEvidence.length === 0 ? (
              <Typography color="text.secondary">
                No approved verification document is available for this account.
              </Typography>
            ) : (
              <Stack spacing={2.5} divider={<Divider flexItem />}>
                {record.approvedVerificationEvidence.map((evidence) => (
                  <Stack
                    key={`${evidence.requestId}:${evidence.evidenceId}`}
                    spacing={1.25}
                  >
                    <Box>
                      <Typography fontWeight={600}>
                        {evidence.companyName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Tax code {evidence.taxIdentifier} · {evidence.fileName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Approved{" "}
                        {evidence.approvedAt
                          ? new Date(evidence.approvedAt).toLocaleString()
                          : "date unavailable"}
                      </Typography>
                    </Box>
                    <ProtectedEvidenceViewer
                      requestId={evidence.requestId}
                      evidenceId={evidence.evidenceId}
                      mediaType={evidence.mediaType}
                      byteSize={evidence.byteSize}
                      malwareStatus={evidence.safetyState}
                      typeStatus={evidence.safetyState}
                      structureStatus={evidence.safetyState}
                      previewStatus={evidence.safetyState}
                      createdAt={evidence.submittedAt}
                      submissionVersion={evidence.version}
                      accessible={evidence.accessibility === "AVAILABLE"}
                      unavailabilityReason={evidence.unavailabilityReason}
                      readOnly
                    />
                  </Stack>
                ))}
              </Stack>
            )}
          </Section>
        </Stack>

        <Stack
          spacing={2.5}
          sx={{ position: { lg: "sticky" }, top: { lg: 16 } }}
        >
          <Section id="moderation-heading" title="Moderation eligibility">
            {record.moderation.protectedAdministrator ? (
              <Alert severity="info">
                This account is protected by current platform administrator
                authority.
              </Alert>
            ) : (
              <Alert
                severity={
                  account.status === "SUSPENDED" ? "warning" : "success"
                }
              >
                Suspend:{" "}
                {record.moderation.canSuspend ? "Eligible" : "Unavailable"};
                Restore:{" "}
                {record.moderation.canRestore ? "Eligible" : "Unavailable"}
              </Alert>
            )}
            <AccountModerationPanel
              account={account}
              moderation={record.moderation}
              onDone={() => refresh()}
            />
          </Section>
          <Section id="history-heading" title="Moderation history">
            {record.history.length === 0 ? (
              <Typography color="text.secondary">
                No moderation history recorded.
              </Typography>
            ) : (
              <Stack spacing={1.25} divider={<Divider flexItem />}>
                {record.history.map((item) => (
                  <Box key={item.id}>
                    <Typography variant="body2" fontWeight={600}>
                      {item.action} · {item.result}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {adminReasonLabel(item.category)} ·{" "}
                      {new Date(item.occurredAt).toLocaleString()} ·{" "}
                      {item.actorRef}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Section>
        </Stack>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
        Calculated {new Date(record.calculatedAt).toLocaleString()}. Protected
        CV/application content and session data are not displayed.
      </Typography>
    </Box>
  );
}

export function AccountDetailShow() {
  return (
    <Show>
      <Content />
    </Show>
  );
}
