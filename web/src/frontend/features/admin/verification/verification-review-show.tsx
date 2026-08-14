"use client";

import { Alert, Box, Typography } from "@mui/material";
import { Show, useRecordContext, useRefresh } from "react-admin";
import { ProtectedEvidenceViewer } from "./protected-evidence-viewer";
import { VerificationDecisionPanel } from "./verification-decision-panel";

type VerificationReview = {
  request: {
    id: string;
    applicantId: string;
    companyName: string;
    taxCode: string;
    state: string;
    applicantEligibility: "ACTIVE" | "SUSPENDED";
    submittedAt: string;
    resubmissionCount: number;
    assignedAdminRef: string | null;
    version: number;
  };
  company: {
    name: string;
    taxCode: string;
    targetKind: string;
    prerequisiteState: string;
  };
  evidence: {
    id: string;
    version: number;
    fileName: string;
    mediaType: "image/png" | "image/jpeg" | "application/pdf";
    byteSize: number;
    safetyState: "PENDING" | "PASS" | "FAIL" | "ERROR";
    accessibility: "AVAILABLE" | "INACCESSIBLE" | "DELETED";
  } | null;
  versions: VerificationReview["evidence"][];
  decisions: Array<{
    id: string;
    decision: string;
    category: string | null;
    applicantComment: string | null;
    decidedAt: string;
    reviewerRef: string;
  }>;
  notes: Array<{ id: string; reviewerRef: string; text: string; createdAt: string }>;
  applicantComment: string | null;
  canDecide: boolean;
  blockReason: string | null;
  calculatedAt: string;
};

function Review() {
  const record = useRecordContext<VerificationReview>();
  const refresh = useRefresh();
  if (!record) return null;
  const current = record.request;
  return (
    <Box sx={{ p: 2, display: "grid", gap: 2 }}>
      <Typography component="h1" variant="h5">
        Recruiter verification review
      </Typography>
      <Typography>Applicant reference: {current.applicantId}</Typography>
      <Typography>
        Company: {record.company.name}; tax code: {record.company.taxCode}; target: {record.company.targetKind}
      </Typography>
      <Typography>
        Applicant account: {current.applicantEligibility}; lifecycle: {current.state}; version: {current.version}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Submitted {new Date(current.submittedAt).toLocaleString()}; resubmissions: {current.resubmissionCount}; calculated {new Date(record.calculatedAt).toLocaleString()}.
      </Typography>
      {record.evidence ? (
        <ProtectedEvidenceViewer
          requestId={current.id}
          evidenceId={record.evidence.id}
          mediaType={record.evidence.mediaType}
          byteSize={record.evidence.byteSize}
          malwareStatus={record.evidence.safetyState}
          typeStatus={record.evidence.safetyState}
          structureStatus={record.evidence.safetyState}
          previewStatus={record.evidence.safetyState}
          createdAt={current.submittedAt}
          submissionVersion={record.evidence.version}
          accessible={record.evidence.accessibility === "AVAILABLE"}
        />
      ) : (
        <Alert severity="warning">No current qualified evidence is available.</Alert>
      )}
      {record.applicantComment !== null ? (
        <Alert severity="info">Recorded applicant-visible outcome: {record.applicantComment}</Alert>
      ) : record.decisions.some((decision) => decision.decision === "REJECTED") ? (
        <Alert severity="info">Applicant-visible rejection reason: unavailable for this legacy record.</Alert>
      ) : null}
      {record.notes.length > 0 && (
        <Box component="section" aria-labelledby="protected-notes-heading">
          <Typography id="protected-notes-heading" component="h2" variant="h6">Protected administrator notes</Typography>
          {record.notes.map((note) => <Typography key={note.id}>{note.text}</Typography>)}
        </Box>
      )}
      <VerificationDecisionPanel
        requestId={current.id}
        version={current.version}
        state={current.state}
        applicantEligibility={current.applicantEligibility}
        canDecide={record.canDecide}
        blockReason={record.blockReason}
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
