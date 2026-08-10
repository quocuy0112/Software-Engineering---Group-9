"use client";
import { Box, Typography } from "@mui/material";
import { Show, useRecordContext, useRefresh } from "react-admin";
import { ProtectedEvidenceViewer } from "./protected-evidence-viewer";
import { VerificationDecisionPanel } from "./verification-decision-panel";
type Verification = {
  id: string;
  applicantDisplayName: string;
  applicantAccountId: string;
  companyName: string;
  normalizedTaxIdentifier: string;
  requestedRole: string;
  state: string;
  currentSubmissionVersion: number;
  resubmissionCount: number;
  version: number;
  viewerUnavailableSince: string | null;
  evidence: Array<{
    id: string;
    submissionVersion: number;
    declaredMediaType: string;
    detectedMediaType: string | null;
    accessible: boolean;
  }>;
};
function Review() {
  const record = useRecordContext<Verification>();
  const refresh = useRefresh();
  if (!record) return null;
  const evidence = record.evidence.find(
    (item) => item.submissionVersion === record.currentSubmissionVersion,
  );
  return (
    <Box sx={{ p: 2, display: "grid", gap: 2 }}>
      <Typography component="h1" variant="h5">
        Verification request {record.id}
      </Typography>
      <Typography>
        Applicant: {record.applicantDisplayName} ({record.applicantAccountId})
      </Typography>
      <Typography>
        Company: {record.companyName}; tax identifier:{" "}
        {record.normalizedTaxIdentifier}; requested role: {record.requestedRole}
      </Typography>
      <Typography>
        State: {record.state}; submission: {record.currentSubmissionVersion};
        resubmissions: {record.resubmissionCount}/3
      </Typography>
      {evidence && (
        <ProtectedEvidenceViewer
          requestId={record.id}
          evidenceId={evidence.id}
          mediaType={evidence.detectedMediaType ?? evidence.declaredMediaType}
          accessible={evidence.accessible}
        />
      )}
      <VerificationDecisionPanel
        requestId={record.id}
        version={record.version}
        state={record.state}
        resubmissionCount={record.resubmissionCount}
        disabled={
          !evidence?.accessible || Boolean(record.viewerUnavailableSince)
        }
        onDone={refresh}
      />
    </Box>
  );
}
export function VerificationReviewShow() {
  return (
    <Show>
      <Review />
    </Show>
  );
}
