"use client";

import {
  Alert,
  Box,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { Show, useRecordContext, useRefresh } from "react-admin";
import { ProtectedEvidenceViewer } from "./protected-evidence-viewer";
import { VerificationDecisionPanel } from "./verification-decision-panel";

type Evidence = {
  id: string;
  version: number;
  fileName: string;
  mediaType: "image/png" | "image/jpeg" | "application/pdf";
  byteSize: number;
  safetyState: "PENDING" | "PASS" | "FAIL" | "ERROR";
  accessibility: "AVAILABLE" | "INACCESSIBLE" | "DELETED";
};

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
  evidence: Evidence | null;
  versions: Evidence[];
  decisions: Array<{
    id: string;
    decision: string;
    category: string | null;
    applicantComment: string | null;
    decidedAt: string;
    reviewerRef: string;
  }>;
  notes: Array<{
    id: string;
    reviewerRef: string;
    text: string;
    createdAt: string;
  }>;
  applicantComment: string | null;
  canDecide: boolean;
  blockReason: string | null;
  calculatedAt: string;
};

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function sentenceCase(value: string) {
  return value
    .replace(/_/gu, " ")
    .toLowerCase()
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function StateChip({ value }: { value: string }) {
  const color =
    value === "APPROVED"
      ? "success"
      : value === "REJECTED"
        ? "error"
        : value === "PENDING_REVIEW"
          ? "warning"
          : "default";
  return <Chip label={sentenceCase(value)} color={color} size="small" />;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ overflowWrap: "anywhere" }}>{value}</Typography>
    </Box>
  );
}

function Review() {
  const record = useRecordContext<VerificationReview>();
  const refresh = useRefresh();
  if (!record) return null;

  const current = record.request;
  const evidence = record.evidence;

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1440, mx: "auto" }}>
      <Stack spacing={2.5}>
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: "primary.50" }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              alignItems={{ md: "flex-start" }}
              spacing={1.5}
            >
              <Box>
                <Typography
                  variant="overline"
                  color="primary.main"
                  fontWeight={700}
                >
                  Recruiter access review
                </Typography>
                <Typography component="h1" variant="h4" fontWeight={750}>
                  {record.company.name}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  Request {current.id} · submitted{" "}
                  {dateTime(current.submittedAt)}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <StateChip value={current.state} />
                <Chip
                  label={`Version ${current.version}`}
                  size="small"
                  variant="outlined"
                />
              </Stack>
            </Stack>
          </Box>
          <Box
            sx={{
              p: { xs: 2, md: 3 },
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                lg: "repeat(4, 1fr)",
              },
              gap: 2,
            }}
          >
            <Detail label="Applicant reference" value={current.applicantId} />
            <Detail label="Tax code" value={record.company.taxCode} />
            <Detail
              label="Request type"
              value={sentenceCase(record.company.targetKind)}
            />
            <Detail
              label="Assigned administrator"
              value={current.assignedAdminRef ?? "Unassigned"}
            />
          </Box>
        </Paper>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 360px" },
            gap: 2.5,
            alignItems: "start",
          }}
        >
          <Stack spacing={2.5}>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Typography component="h2" variant="h6" fontWeight={700}>
                Review context
              </Typography>
              <Box
                sx={{
                  mt: 2,
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                  gap: 2,
                }}
              >
                <Detail
                  label="Applicant account"
                  value={sentenceCase(current.applicantEligibility)}
                />
                <Detail
                  label="Verification prerequisite"
                  value={sentenceCase(record.company.prerequisiteState)}
                />
                <Detail
                  label="Resubmissions"
                  value={current.resubmissionCount}
                />
                <Detail
                  label="Review data calculated"
                  value={dateTime(record.calculatedAt)}
                />
              </Box>
            </Paper>

            {evidence ? (
              <ProtectedEvidenceViewer
                key={`${current.id}:${evidence.id}`}
                requestId={current.id}
                evidenceId={evidence.id}
                mediaType={evidence.mediaType}
                byteSize={evidence.byteSize}
                malwareStatus={evidence.safetyState}
                typeStatus={evidence.safetyState}
                structureStatus={evidence.safetyState}
                previewStatus={evidence.safetyState}
                createdAt={current.submittedAt}
                submissionVersion={evidence.version}
                accessible={evidence.accessibility === "AVAILABLE"}
              />
            ) : (
              <Alert severity="warning">
                No current qualified evidence is available for this request.
              </Alert>
            )}

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Typography component="h2" variant="h6" fontWeight={700}>
                Decision history
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 2 }}>
                {record.decisions.length ? (
                  record.decisions.map((decision) => (
                    <Box
                      key={decision.id}
                      sx={{
                        borderLeft: 3,
                        borderColor: "primary.light",
                        pl: 1.5,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <StateChip value={decision.decision} />
                        {decision.category && (
                          <Chip
                            label={sentenceCase(decision.category)}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.75 }}
                      >
                        {dateTime(decision.decidedAt)} · reviewer{" "}
                        {decision.reviewerRef}
                      </Typography>
                      {decision.applicantComment && (
                        <Typography sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>
                          {decision.applicantComment}
                        </Typography>
                      )}
                    </Box>
                  ))
                ) : (
                  <Typography color="text.secondary">
                    No decision has been recorded yet.
                  </Typography>
                )}
              </Stack>
            </Paper>

            {record.notes.length > 0 && (
              <Paper
                component="section"
                aria-labelledby="protected-notes-heading"
                variant="outlined"
                sx={{ p: { xs: 2, md: 2.5 }, bgcolor: "warning.50" }}
              >
                <Typography
                  id="protected-notes-heading"
                  component="h2"
                  variant="h6"
                  fontWeight={700}
                >
                  Protected administrator notes
                </Typography>
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                  {record.notes.map((note) => (
                    <Box key={note.id}>
                      <Typography sx={{ whiteSpace: "pre-wrap" }}>
                        {note.text}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {note.reviewerRef} · {dateTime(note.createdAt)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            )}
          </Stack>

          <Stack
            spacing={2.5}
            sx={{ position: { lg: "sticky" }, top: { lg: 20 } }}
          >
            {record.applicantComment !== null ? (
              <Alert severity="info">
                Applicant-visible outcome: {record.applicantComment}
              </Alert>
            ) : record.decisions.some(
                (decision) => decision.decision === "REJECTED",
              ) ? (
              <Alert severity="info">
                Applicant-visible rejection reason is unavailable for this
                legacy record.
              </Alert>
            ) : null}
            <Paper
              component="section"
              aria-labelledby="review-decision-heading"
              variant="outlined"
              sx={{ p: 2.5 }}
            >
              <Typography
                id="review-decision-heading"
                component="h2"
                variant="h6"
                fontWeight={700}
              >
                Decision
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.75, mb: 2 }}
              >
                Decisions are irreversible audit events. Confirm the evidence
                and applicant eligibility before continuing.
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <VerificationDecisionPanel
                requestId={current.id}
                version={current.version}
                state={current.state}
                applicantEligibility={current.applicantEligibility}
                canDecide={record.canDecide}
                blockReason={record.blockReason}
                onDone={refresh}
              />
            </Paper>
          </Stack>
        </Box>
      </Stack>
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
