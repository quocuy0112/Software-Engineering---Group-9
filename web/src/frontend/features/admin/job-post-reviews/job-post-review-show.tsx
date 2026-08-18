"use client";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  Divider,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { Show, useRecordContext } from "react-admin";
import type { JobReviewSnapshot } from "@/shared/contracts/recruiter-job-posting";
import { JobPostReviewActionPanel } from "./job-post-review-action-panel";

type ReviewDetailRecord = {
  id: string;
  state: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  assignment: string | null;
  sequence: number;
  version: number;
  submittedAt: string;
  ageSeconds: number;
  integrityState?: "VALID" | "BLOCKED";
  snapshot: JobReviewSnapshot;
  priorApprovedSnapshot?: JobReviewSnapshot | null;
  company: {
    displayName: string;
    verificationState: string;
    active: boolean;
    protectedVerificationHref?: string | null;
  };
  submitter: {
    displayName: string;
    membershipState: string;
    currentlyEligible: boolean;
  };
  decision: {
    adminUserId: string | null;
    decidedAt: string;
    publishedAt: string | null;
    reasonCode: string | null;
    publicExplanation: string | null;
  } | null;
  history: Array<{
    id: string;
    action: string;
    resultingState: string;
    resultingVersion: number;
    occurredAt: string;
  }>;
  privateNotes: Array<{
    id: string;
    authorAdminUserId: string;
    normalizedText: string;
    createdAt: string;
  }>;
};

const labelForField: Record<string, string> = {
  title: "Job title",
  shortPitch: "Short pitch",
  industry: "Industry",
  subIndustry: "Sub-industry",
  categoryIds: "Categories",
  categoryFamily: "Category family",
  skillTags: "Skills",
  location: "Location",
  salary: "Salary",
  experience: "Experience",
  level: "Seniority",
  employmentType: "Employment type",
  workArrangement: "Work arrangement",
  workOnSaturday: "Saturday work",
  education: "Education",
  age: "Age guidance",
  numberOfHires: "Openings",
  applyDeadline: "Application deadline",
  description: "Job description",
};

function display(value: string | null | undefined) {
  return value?.trim() || "Not specified";
}

function sentenceCase(value: string) {
  return value
    .replace(/_/gu, " ")
    .toLowerCase()
    .replace(/\b\w/gu, (character) => character.toUpperCase());
}

function dateTime(value: string | null | undefined) {
  if (!value) return "Not specified";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString();
}

function relativeAge(seconds: number) {
  if (seconds < 60) return "Just now";
  if (seconds < 3_600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)} hr ago`;
  return `${Math.floor(seconds / 86_400)} days ago`;
}

function salary(snapshot: JobReviewSnapshot) {
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: snapshot.salary.currency,
    maximumFractionDigits: 0,
  });
  const range = `${money.format(snapshot.salary.min)} - ${money.format(
    snapshot.salary.max,
  )}`;
  return `${range} / ${sentenceCase(snapshot.salary.period)}${
    snapshot.salary.isNegotiable ? " / Negotiable" : ""
  }`;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => valuesEqual(value, right[index]))
    );
  }
  if (
    typeof left === "object" &&
    left !== null &&
    typeof right === "object" &&
    right !== null
  ) {
    const leftEntries = Object.entries(left);
    const rightRecord = right as Record<string, unknown>;
    return (
      leftEntries.length === Object.keys(rightRecord).length &&
      leftEntries.every(
        ([key, value]) =>
          Object.hasOwn(rightRecord, key) &&
          valuesEqual(value, rightRecord[key]),
      )
    );
  }
  return false;
}

function changedSnapshotFields(record: ReviewDetailRecord) {
  if (!record.priorApprovedSnapshot) return [];
  return Object.keys(labelForField).filter(
    (field) =>
      !valuesEqual(
        record.priorApprovedSnapshot?.[field as keyof JobReviewSnapshot],
        record.snapshot[field as keyof JobReviewSnapshot],
      ),
  );
}

function StatusChip({ value, ok }: { value: string; ok?: boolean }) {
  return (
    <Chip
      label={value}
      color={ok === undefined ? "default" : ok ? "success" : "warning"}
      size="small"
      variant={ok === undefined ? "outlined" : "filled"}
    />
  );
}

function Section({
  title,
  children,
  defaultExpanded = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  return (
    <Accordion defaultExpanded={defaultExpanded} disableGutters elevation={0}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography component="h2" variant="subtitle1" fontWeight={700}>
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>{children}</AccordionDetails>
    </Accordion>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length)
    return <Typography color="text.secondary">Not specified</Typography>;
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5, display: "grid", gap: 0.75 }}>
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>
          <Typography>{item}</Typography>
        </li>
      ))}
    </Box>
  );
}

function ReviewDetail() {
  const record = useRecordContext<ReviewDetailRecord>();
  if (!record) return null;

  const snapshot = record.snapshot;
  const changedFields = changedSnapshotFields(record);
  const location = [snapshot.location.district, snapshot.location.city]
    .filter(Boolean)
    .join(", ");

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1440, mx: "auto" }}>
      <Stack spacing={2.5}>
        <Box>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ md: "flex-start" }}
            spacing={1.5}
          >
            <Box>
              <Typography component="h1" variant="h4" fontWeight={750}>
                {snapshot.title}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {record.company.displayName} / Version {record.sequence} /
                Submitted {dateTime(record.submittedAt)}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <StatusChip value={sentenceCase(record.state)} />
              <StatusChip
                value={`Integrity: ${record.integrityState ?? "VALID"}`}
                ok={(record.integrityState ?? "VALID") === "VALID"}
              />
            </Stack>
          </Stack>
        </Box>

        {record.integrityState === "BLOCKED" && (
          <Alert severity="error">
            The submitted snapshot cannot be validated. Approval and rejection
            are unavailable until integrity is restored.
          </Alert>
        )}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 360px" },
            gap: 2.5,
            alignItems: "start",
          }}
        >
          <Stack spacing={2.5}>
            <Paper variant="outlined" sx={{ overflow: "hidden" }}>
              <Box sx={{ p: 2.5, bgcolor: "primary.50" }}>
                <Typography
                  variant="overline"
                  color="primary.main"
                  fontWeight={700}
                >
                  Submitted job posting
                </Typography>
                <Typography variant="h6" sx={{ mt: 0.25 }}>
                  {snapshot.shortPitch}
                </Typography>
                <Stack
                  direction="row"
                  flexWrap="wrap"
                  gap={0.75}
                  sx={{ mt: 2 }}
                >
                  {snapshot.skillTags.map((skill) => (
                    <Chip key={skill} label={skill} size="small" />
                  ))}
                </Stack>
              </Box>

              <Box
                sx={{
                  p: 2.5,
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                  gap: 2,
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Location
                  </Typography>
                  <Typography>{location || "Not specified"}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {snapshot.location.isNationwideRemote
                      ? "Nationwide remote available"
                      : sentenceCase(snapshot.workArrangement)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Compensation
                  </Typography>
                  <Typography>{salary(snapshot)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Role details
                  </Typography>
                  <Typography>
                    {sentenceCase(snapshot.employmentType)} ·{" "}
                    {sentenceCase(snapshot.level)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {snapshot.numberOfHires} opening
                    {snapshot.numberOfHires === 1 ? "" : "s"}
                    {snapshot.workOnSaturday ? " / Saturday work" : ""}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Application deadline
                  </Typography>
                  <Typography>{dateTime(snapshot.applyDeadline)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Experience: {snapshot.experience.label} /{" "}
                    {snapshot.experience.minYears}+ years
                  </Typography>
                </Box>
                <Box sx={{ gridColumn: { sm: "span 2" } }}>
                  <Typography variant="caption" color="text.secondary">
                    Job classification
                  </Typography>
                  <Typography>
                    {display(snapshot.industry)} /{" "}
                    {display(snapshot.subIndustry)} /{" "}
                    {display(snapshot.categoryFamily)}
                  </Typography>
                  <Stack
                    direction="row"
                    flexWrap="wrap"
                    gap={0.75}
                    sx={{ mt: 0.75 }}
                  >
                    {snapshot.categoryIds.length ? (
                      snapshot.categoryIds.map((category) => (
                        <Chip
                          key={category}
                          label={category}
                          size="small"
                          variant="outlined"
                        />
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No categories selected
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ px: { xs: 1, sm: 2 } }}>
              <Section title="Role overview" defaultExpanded>
                <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.75 }}>
                  {snapshot.description.overview}
                </Typography>
              </Section>
              <Divider />
              <Section title="Responsibilities">
                <BulletList items={snapshot.description.responsibilities} />
              </Section>
              <Divider />
              <Section title="Requirements">
                <Stack spacing={1.5}>
                  <BulletList items={snapshot.description.requirements} />
                  <Typography variant="body2" color="text.secondary">
                    Education: {display(snapshot.education)} / Age guidance:{" "}
                    {display(snapshot.age)}
                  </Typography>
                </Stack>
              </Section>
              <Divider />
              <Section title="Benefits and reasons to join">
                <Stack spacing={2}>
                  <BulletList items={snapshot.description.topReasonsToJoin} />
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {snapshot.description.benefits.map((benefit) => (
                      <Chip
                        key={`${benefit.icon}-${benefit.label}`}
                        label={`${benefit.icon} ${benefit.label}`}
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                </Stack>
              </Section>
              <Divider />
              <Section title="Working information">
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                    gap: 1.5,
                  }}
                >
                  {[
                    ["Department", snapshot.description.generalInfo.department],
                    ["Reports to", snapshot.description.generalInfo.reportsTo],
                    [
                      "Working hours",
                      snapshot.description.generalInfo.workingHours,
                    ],
                    [
                      "Work address",
                      snapshot.description.generalInfo.workAddress,
                    ],
                  ].map(([label, value]) => (
                    <Box key={label}>
                      <Typography variant="caption" color="text.secondary">
                        {label}
                      </Typography>
                      <Typography>{display(value)}</Typography>
                    </Box>
                  ))}
                </Box>
              </Section>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography component="h2" variant="subtitle1" fontWeight={700}>
                Version comparison
              </Typography>
              {record.priorApprovedSnapshot ? (
                changedFields.length ? (
                  <Stack
                    direction="row"
                    flexWrap="wrap"
                    gap={0.75}
                    sx={{ mt: 1.5 }}
                  >
                    {changedFields.map((field) => (
                      <Chip
                        key={field}
                        label={labelForField[field] ?? field}
                        color="warning"
                        size="small"
                      />
                    ))}
                  </Stack>
                ) : (
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    No material content changed from the prior approved version.
                  </Typography>
                )
              ) : (
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  This is the first submitted version; there is no earlier
                  approved snapshot.
                </Typography>
              )}
            </Paper>
          </Stack>

          <Stack
            spacing={2.5}
            sx={{ position: { lg: "sticky" }, top: { lg: 20 } }}
          >
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography component="h2" variant="subtitle1" fontWeight={700}>
                Review context
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Company
                  </Typography>
                  <Typography>{record.company.displayName}</Typography>
                  <Stack direction="row" gap={0.75} sx={{ mt: 0.5 }}>
                    <StatusChip
                      value={sentenceCase(record.company.verificationState)}
                      ok={record.company.active}
                    />
                  </Stack>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Submitter
                  </Typography>
                  <Typography>{record.submitter.displayName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Membership: {sentenceCase(record.submitter.membershipState)}
                  </Typography>
                  <StatusChip
                    value={
                      record.submitter.currentlyEligible
                        ? "Currently eligible"
                        : "Not currently eligible"
                    }
                    ok={record.submitter.currentlyEligible}
                  />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Assignment
                  </Typography>
                  <Typography>{record.assignment ?? "Unassigned"}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Queue age: {relativeAge(record.ageSeconds)} / Aggregate v
                    {record.version}
                  </Typography>
                </Box>
                {record.company.protectedVerificationHref && (
                  <Link
                    href={record.company.protectedVerificationHref}
                    underline="hover"
                  >
                    View company verification requests
                  </Link>
                )}
              </Stack>
            </Paper>

            {record.decision && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography component="h2" variant="subtitle1" fontWeight={700}>
                  Decision
                </Typography>
                <Stack spacing={1} sx={{ mt: 1.5 }}>
                  <Typography>
                    Decided {dateTime(record.decision.decidedAt)}
                  </Typography>
                  {record.decision.reasonCode && (
                    <StatusChip
                      value={sentenceCase(record.decision.reasonCode)}
                    />
                  )}
                  {record.decision.publicExplanation && (
                    <Typography sx={{ whiteSpace: "pre-wrap" }}>
                      {record.decision.publicExplanation}
                    </Typography>
                  )}
                </Stack>
              </Paper>
            )}

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography component="h2" variant="subtitle1" fontWeight={700}>
                Immutable history
              </Typography>
              <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                {record.history.length ? (
                  record.history.map((item) => (
                    <Box
                      key={item.id}
                      sx={{
                        borderLeft: 2,
                        borderColor: "primary.light",
                        pl: 1.25,
                      }}
                    >
                      <Typography variant="body2" fontWeight={700}>
                        {sentenceCase(item.action)} / v{item.resultingVersion}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {sentenceCase(item.resultingState)} ·{" "}
                        {dateTime(item.occurredAt)}
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <Typography color="text.secondary">
                    No lifecycle events recorded.
                  </Typography>
                )}
              </Stack>
            </Paper>

            {record.privateNotes.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2, bgcolor: "warning.50" }}>
                <Typography component="h2" variant="subtitle1" fontWeight={700}>
                  Administrator private notes
                </Typography>
                <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                  {record.privateNotes.map((note) => (
                    <Box key={note.id}>
                      <Typography sx={{ whiteSpace: "pre-wrap" }}>
                        {note.normalizedText}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {note.authorAdminUserId} / {dateTime(note.createdAt)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            )}

            <JobPostReviewActionPanel />
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

export function JobPostReviewShow() {
  return (
    <Show>
      <ReviewDetail />
    </Show>
  );
}
