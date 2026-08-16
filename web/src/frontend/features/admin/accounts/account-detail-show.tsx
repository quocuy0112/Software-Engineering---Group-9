"use client";

import { Alert, Box, Button, Chip, Divider, Typography } from "@mui/material";
import { Show, useRecordContext, useRefresh } from "react-admin";
import { AccountModerationPanel } from "./account-moderation-panel";
import { ProtectedEvidenceViewer } from "../verification/protected-evidence-viewer";

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

function Count({
  value,
  label,
}: {
  value: CountProjection | null;
  label: string;
}) {
  if (!value) return null;
  if ("unavailable" in value)
    return <Typography>{label}: Unavailable — retry to confirm</Typography>;
  if (value.kind === "CANDIDATE")
    return (
      <Typography>
        {label}: CVs {value.cvCount}; submitted applications{" "}
        {value.applicationCount}
      </Typography>
    );
  return (
    <Box component="dl" sx={{ m: 0, display: "grid", gap: 0.5 }}>
      {(
        [
          ["Active", value.active],
          ["Pending Review", value.pendingReview],
          ["Rejected", value.rejected],
          ["Draft", value.draft],
          ["Closed", value.closed],
        ] as const
      ).map(([name, count]) => (
        <Typography component="div" key={name}>
          <Box component="dt" sx={{ display: "inline", fontWeight: 600 }}>
            {name}:
          </Box>{" "}
          <Box component="dd" sx={{ display: "inline", m: 0 }}>
            {count}
          </Box>
        </Typography>
      ))}
    </Box>
  );
}

function Content() {
  const record = useRecordContext<AccountDetail>();
  const refresh = useRefresh();
  if (!record) return null;
  const { account } = record;
  return (
    <Box sx={{ p: 2, display: "grid", gap: 2, maxWidth: 960 }}>
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}
      >
        <Typography component="h1" variant="h5" sx={{ mr: "auto" }}>
          Account details
        </Typography>
        <Button onClick={() => refresh()}>Refresh</Button>
      </Box>
      <Box
        component="section"
        aria-labelledby="account-identity-heading"
        sx={{ display: "grid", gap: 1 }}
      >
        <Typography id="account-identity-heading" component="h2" variant="h6">
          {account.displayName}
        </Typography>
        <Typography>Account reference: {account.accountReference}</Typography>
        <Typography>Masked email: {account.maskedEmail}</Typography>
        <Typography>
          Registered: {new Date(account.registeredAt).toLocaleString()}
        </Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Chip
            label={account.type === "RECRUITER" ? "Recruiter" : "Candidate"}
          />
          <Chip
            label={account.status === "SUSPENDED" ? "Suspended" : "Active"}
          />
        </Box>
      </Box>
      <Divider />
      <Box component="section" aria-labelledby="candidate-activity-heading">
        <Typography id="candidate-activity-heading" component="h2" variant="h6">
          Candidate activity
        </Typography>
        <Count value={record.candidateActivity} label="Candidate records" />
      </Box>
      {record.recruiterActivity && (
        <Box component="section" aria-labelledby="recruiter-activity-heading">
          <Typography
            id="recruiter-activity-heading"
            component="h2"
            variant="h6"
          >
            Recruiter activity
          </Typography>
          <Count value={record.recruiterActivity} label="Job postings submitted" />
        </Box>
      )}
      {record.authorities.length > 0 && (
        <Box
          component="section"
          aria-labelledby="authority-heading"
          sx={{ display: "grid", gap: 1 }}
        >
          <Typography id="authority-heading" component="h2" variant="h6">
            Company authority
          </Typography>
          {record.authorities.map((authority) => (
            <Box
              key={authority.companyId}
              sx={{ border: 1, borderColor: "divider", p: 1 }}
            >
              <Typography>{authority.companyName}</Typography>
              <Typography variant="body2">
                {authority.membershipRole}; membership{" "}
                {authority.membershipState}; company{" "}
                {authority.verificationState}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
      <Box
        component="section"
        aria-labelledby="approved-verification-evidence-heading"
        sx={{ display: "grid", gap: 1.5 }}
      >
        <Typography
          id="approved-verification-evidence-heading"
          component="h2"
          variant="h6"
        >
          Approved verification evidence
        </Typography>
        {record.approvedVerificationEvidence.length === 0 ? (
          <Typography>
            No approved verification document is available for this account.
          </Typography>
        ) : (
          record.approvedVerificationEvidence.map((evidence) => (
            <Box
              key={`${evidence.requestId}:${evidence.evidenceId}`}
              sx={{ display: "grid", gap: 1 }}
            >
              <Typography>
                {evidence.companyName} — tax code {evidence.taxIdentifier}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {evidence.fileName}; approved{" "}
                {evidence.approvedAt
                  ? new Date(evidence.approvedAt).toLocaleString()
                  : "date unavailable"}
              </Typography>
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
                readOnly
              />
            </Box>
          ))
        )}
      </Box>
      <Box component="section" aria-labelledby="moderation-heading">
        <Typography id="moderation-heading" component="h2" variant="h6">
          Moderation eligibility
        </Typography>
        {record.moderation.protectedAdministrator ? (
          <Alert severity="info">
            This account is protected by current platform administrator
            authority.
          </Alert>
        ) : (
          <Typography>
            Suspend: {record.moderation.canSuspend ? "Eligible" : "Unavailable"}
            ; Restore:{" "}
            {record.moderation.canRestore ? "Eligible" : "Unavailable"}
          </Typography>
        )}
        <AccountModerationPanel
          account={account}
          moderation={record.moderation}
          onDone={() => refresh()}
        />
      </Box>
      <Box component="section" aria-labelledby="history-heading">
        <Typography id="history-heading" component="h2" variant="h6">
          Moderation history
        </Typography>
        {record.history.length === 0 ? (
          <Typography>No moderation history recorded.</Typography>
        ) : (
          record.history.map((item) => (
            <Typography key={item.id}>
              {item.action} — {item.result} — {item.category} —{" "}
              {new Date(item.occurredAt).toLocaleString()} ({item.actorRef})
            </Typography>
          ))
        )}
      </Box>
      <Typography variant="caption" color="text.secondary">
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
