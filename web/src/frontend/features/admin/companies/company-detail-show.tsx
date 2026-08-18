"use client";

import { Alert, Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { Show, useRecordContext } from "react-admin";

type CompanyDetail = {
  company: {
    id: string;
    legalName: string;
    displayName: string;
    verificationState: "UNVERIFIED" | "ACTIVE" | "INACTIVE";
    verifiedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  membershipSummary: {
    total: number;
    active: number;
    suspended: number;
    removed: number;
    activeOwnerCount: number;
    recent: Array<{
      id: string;
      accountDisplayName: string;
      role: string;
      state: string;
      updatedAt: string;
    }>;
  };
  verificationSummary: {
    totalRequestCount: number;
    latest: {
      id: string;
      state: string;
      submittedAt: string;
      updatedAt: string;
    } | null;
  };
  activitySummary: {
    activeJobCount: number;
    closedJobCount: number;
    pendingJobReviewCount: number;
    openModerationReportCount: number;
  };
};

function dateTime(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function sentenceCase(value: string) {
  return value
    .replace(/_/gu, " ")
    .toLowerCase()
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Box>
      <Typography variant="h5" fontWeight={750}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

export function CompanyDetailContent() {
  const record = useRecordContext<CompanyDetail>();
  if (!record) return null;

  const { company, membershipSummary, verificationSummary, activitySummary } =
    record;
  const verificationColor =
    company.verificationState === "ACTIVE"
      ? "success"
      : company.verificationState === "INACTIVE"
        ? "error"
        : "warning";

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
                  Company administration
                </Typography>
                <Typography component="h1" variant="h4" fontWeight={750}>
                  {company.legalName}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  {company.displayName} · {company.id}
                </Typography>
              </Box>
              <Chip
                label={`Verification: ${sentenceCase(company.verificationState)}`}
                color={verificationColor}
                size="small"
              />
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
            <Detail label="Verified at" value={dateTime(company.verifiedAt)} />
            <Detail label="Created" value={dateTime(company.createdAt)} />
            <Detail label="Last updated" value={dateTime(company.updatedAt)} />
            <Detail label="Company reference" value={company.id} />
          </Box>
        </Paper>

        {membershipSummary.activeOwnerCount === 0 ? (
          <Alert severity="error">
            This company has no active owner. Review its memberships before
            making further access changes.
          </Alert>
        ) : membershipSummary.activeOwnerCount === 1 ? (
          <Alert severity="warning">
            This company has one active owner. Any membership action must
            preserve an active owner.
          </Alert>
        ) : null}

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
                Membership overview
              </Typography>
              <Box
                sx={{
                  mt: 2,
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "repeat(2, 1fr)",
                    sm: "repeat(4, 1fr)",
                  },
                  gap: 2,
                }}
              >
                <Metric
                  label="All memberships"
                  value={membershipSummary.total}
                />
                <Metric label="Active" value={membershipSummary.active} />
                <Metric label="Suspended" value={membershipSummary.suspended} />
                <Metric
                  label="Active owners"
                  value={membershipSummary.activeOwnerCount}
                />
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Typography component="h2" variant="h6" fontWeight={700}>
                Recent membership changes
              </Typography>
              <Stack spacing={1.25} sx={{ mt: 2 }}>
                {membershipSummary.recent.length ? (
                  membershipSummary.recent.map((membership) => (
                    <Box
                      key={membership.id}
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 2,
                        alignItems: "center",
                        borderLeft: 3,
                        borderColor: "primary.light",
                        pl: 1.5,
                      }}
                    >
                      <Box>
                        <Typography fontWeight={700}>
                          {membership.accountDisplayName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {sentenceCase(membership.role)} · updated{" "}
                          {dateTime(membership.updatedAt)}
                        </Typography>
                      </Box>
                      <Chip
                        label={sentenceCase(membership.state)}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  ))
                ) : (
                  <Typography color="text.secondary">
                    No memberships are associated with this company.
                  </Typography>
                )}
              </Stack>
            </Paper>
          </Stack>

          <Stack spacing={2.5}>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography component="h2" variant="h6" fontWeight={700}>
                Verification
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 2 }}>
                <Detail
                  label="Verification requests"
                  value={verificationSummary.totalRequestCount}
                />
                {verificationSummary.latest ? (
                  <>
                    <Detail
                      label="Latest request"
                      value={verificationSummary.latest.id}
                    />
                    <Detail
                      label="Latest state"
                      value={sentenceCase(verificationSummary.latest.state)}
                    />
                    <Detail
                      label="Last updated"
                      value={dateTime(verificationSummary.latest.updatedAt)}
                    />
                  </>
                ) : (
                  <Typography color="text.secondary">
                    No verification request is associated with this company.
                  </Typography>
                )}
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography component="h2" variant="h6" fontWeight={700}>
                Recruitment activity
              </Typography>
              <Box
                sx={{
                  mt: 2,
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 2,
                }}
              >
                <Metric
                  label="Active jobs"
                  value={activitySummary.activeJobCount}
                />
                <Metric
                  label="Closed jobs"
                  value={activitySummary.closedJobCount}
                />
                <Metric
                  label="Pending job reviews"
                  value={activitySummary.pendingJobReviewCount}
                />
                <Metric
                  label="Open moderation reports"
                  value={activitySummary.openModerationReportCount}
                />
              </Box>
            </Paper>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

export function CompanyDetailShow() {
  return (
    <Show>
      <CompanyDetailContent />
    </Show>
  );
}
