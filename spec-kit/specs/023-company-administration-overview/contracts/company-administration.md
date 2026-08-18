# Company Administration Contract

## `GET /api/admin/companies/{companyId}`

Requires an active designated platform-administrator session. The response is `no-store`.

### Success response

```text
data: {
  id,
  company: { id, legalName, displayName, verificationState, verifiedAt, createdAt, updatedAt },
  membershipSummary: { total, active, suspended, removed, activeOwnerCount, recent[<=5] },
  verificationSummary: { totalRequestCount, latest | null },
  activitySummary: { activeJobCount, closedJobCount, pendingJobReviewCount, openModerationReportCount }
}
```

### Failure responses

- `401`/`403`: established admin-boundary response.
- `404 TARGET_UNAVAILABLE`: the company does not exist.
- `500`: the request was not completed, including an access-audit persistence failure.

The endpoint never returns tax identifiers, email addresses, evidence URLs, private notes, or full history.
