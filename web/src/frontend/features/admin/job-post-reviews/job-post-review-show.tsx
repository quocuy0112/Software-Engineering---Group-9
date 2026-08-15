"use client";
import { FunctionField, Show, SimpleShowLayout, TextField } from "react-admin";
import { JobPostReviewActionPanel } from "./job-post-review-action-panel";

type ReviewDetailRecord = {
  snapshot?: Record<string, unknown>;
  priorApprovedSnapshot?: Record<string, unknown> | null;
  company?: {
    active?: boolean;
    protectedVerificationHref?: string | null;
  };
  submitter?: { currentlyEligible?: boolean };
};

function changedSnapshotFields(record: ReviewDetailRecord) {
  if (!record.priorApprovedSnapshot || !record.snapshot)
    return "No prior approved version";
  const fields = new Set([
    ...Object.keys(record.priorApprovedSnapshot),
    ...Object.keys(record.snapshot),
  ]);
  const changed = [...fields].filter(
    (field) =>
      JSON.stringify(record.priorApprovedSnapshot?.[field]) !==
      JSON.stringify(record.snapshot?.[field]),
  );
  return changed.length ? changed.join(", ") : "No submitted field changed";
}

export function JobPostReviewShow() {
  return (
    <Show>
      <SimpleShowLayout>
        <TextField source="id" label="Review id" />
        <TextField source="state" />
        <TextField source="assignment" emptyText="Unassigned" />
        <TextField source="sequence" label="Submission version" />
        <TextField source="version" label="Aggregate version" />
        <TextField source="submittedAt" label="Submitted at" />
        <TextField source="ageSeconds" label="Age (seconds)" />
        <TextField source="company.displayName" label="Company" />
        <TextField
          source="company.verificationState"
          label="Company verification state"
        />
        <FunctionField<ReviewDetailRecord>
          label="Company currently eligible"
          render={(record) => (record.company?.active ? "Yes" : "No")}
        />
        <FunctionField<ReviewDetailRecord>
          label="Protected company evidence"
          render={(record) =>
            record.company?.protectedVerificationHref ? (
              <a href={record.company.protectedVerificationHref}>
                Open protected verification viewer
              </a>
            ) : (
              "Unavailable"
            )
          }
        />
        <TextField source="submitter.displayName" label="Submitter" />
        <TextField
          source="submitter.membershipState"
          label="Submitter membership state"
        />
        <FunctionField<ReviewDetailRecord>
          label="Submitter currently eligible"
          render={(record) =>
            record.submitter?.currentlyEligible ? "Yes" : "No"
          }
        />
        <TextField source="integrityState" label="Integrity" />
        <FunctionField
          label="Complete submitted snapshot"
          render={(record) => (
            <pre>{JSON.stringify(record.snapshot, null, 2)}</pre>
          )}
        />
        <FunctionField
          label="Changed fields from prior approval"
          render={(record: ReviewDetailRecord) => changedSnapshotFields(record)}
        />
        <FunctionField
          label="Prior approved snapshot"
          render={(record) => (
            <pre>{JSON.stringify(record.priorApprovedSnapshot, null, 2)}</pre>
          )}
        />
        <FunctionField
          label="Decision"
          render={(record) => (
            <pre>{JSON.stringify(record.decision, null, 2)}</pre>
          )}
        />
        <FunctionField
          label="Immutable history"
          render={(record) => (
            <pre>{JSON.stringify(record.history, null, 2)}</pre>
          )}
        />
        <FunctionField
          label="Administrator private notes"
          render={(record) => (
            <pre>{JSON.stringify(record.privateNotes, null, 2)}</pre>
          )}
        />
        <JobPostReviewActionPanel />
      </SimpleShowLayout>
    </Show>
  );
}
