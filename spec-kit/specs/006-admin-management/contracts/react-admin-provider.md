# React Admin Provider Contract

## Security posture

The provider is a typed browser adapter to explicit SmartHire routes. It is not
an authorization layer and never talks to PostgreSQL, Prisma, private storage,
Better Auth internals, the scanner, or delivery providers.

All calls:

- use same-origin relative URLs and `credentials: "include"`;
- send `Accept: application/json` except protected byte streams;
- use `cache: "no-store"` and propagate AbortSignal for reads;
- validate response envelopes before returning data to React Admin;
- never add credentials/roles/session identifiers to query parameters;
- never persist records, filters, selection, identity, or errors outside the
  configured memory store/query cache;
- clear query cache and memory store before redirect on authority loss.

All command calls additionally send the current session-bound CSRF proof,
`Idempotency-Key`, and `If-Match`/`expectedVersion`. Idempotency keys remain in
memory only and are regenerated after a completed or deliberately abandoned
command.

## Resource projections

### `accounts`

- `getList`: exact FR-014 row shape only.
- Generic `getOne`, `create`, `update`, `delete`, and bulk methods: unsupported.
- Detail uses `getAccountSecurity(accountId)` so React Admin cannot reuse a list
  record as a security detail or vice versa.

### `administrator-grants`

- No menu/list/create/update/delete.
- `getMany` may resolve a safe active/non-active reference already authorized as
  part of account rows; it never exposes provenance details or lifecycle commands.

### `candidate-identities`

- Hidden reference proving base identity only; no Candidate Profile fields.

### `companies`

- `getList` returns only opaque company reference plus public display name for
  authorized verification/membership filters, together with current calculation
  time and the required dashboard state-definition version.
- No company lifecycle/profile mutation.

### `company-memberships`

- `getList`/safe `getOne` only.
- `getList` always returns current `calculatedAt` and the required
  `stateDefinitionVersion` from the shared DashboardDefinition.
- Generic update/delete unsupported; lifecycle uses custom commands.

### `verification-requests`

- `getList` returns no evidence content/location.
- Detail uses `getVerificationReview(requestId)`.
- Generic create/edit/delete unsupported in React Admin; Candidate routes own
  submission/cancellation/resubmission.

### `moderation-reports`

- `getList` returns queue fields and safe references.
- Detail uses `getModerationReport(reportId)`.
- Generic create/edit/delete unsupported; reporter route owns submission and
  custom commands own review changes.

### `support-cases`

- `getList` returns the server-prioritized support inbox with state, category,
  assignee, and age filters; it never contains Feature 008 private conversations.
- `getOne` returns the support transcript, assignment/history timeline, and
  administrator-only notes. Requester projections never contain notes or staff identity.
- Generic create/edit/delete remain disabled; claim, reassign, reply, note,
  resolve, and close use explicit versioned, idempotent commands.

### Nested-only resources

`login-sessions`, `notification-work`, and correlation-specific `audit-events`
are returned only through explicit custom methods. They have no global list or
mutation method.

## Standard method behavior

```ts
type SafeListParams = {
  pagination: { page: number; perPage: 25 | 50 | 100 };
  sort: { field: string; order: "ASC" | "DESC" };
  filter: Record<string, string | string[] | boolean | undefined>;
  signal?: AbortSignal;
};

type SafeListResult<T> = {
  data: T[];
  total: number;
  meta: {
    calculatedAt: string;
    stateDefinitionVersion: string;
  };
};
```

`stateDefinitionVersion` is mandatory for `accounts`, `companies`,
`company-memberships`, `verification-requests`, and `moderation-reports`. A
missing or mismatched value is a contract failure; the provider never substitutes
a client-side definition.

The server allowlists filters and locks the required deterministic ordering.
Unsupported `perPage`, sort, filter, unknown field, or malformed reference
returns a validation error; the provider does not silently coerce it.

## Custom query methods

```ts
type SmartHireAdminDataProvider = DataProvider & {
  getDashboardSnapshot(signal?: AbortSignal): Promise<DashboardSnapshot>;
  getAccountSecurity(
    accountId: string,
    signal?: AbortSignal,
  ): Promise<AccountSecurity>;
  getPrivilegedRationale(
    correlationId: string,
    signal?: AbortSignal,
  ): Promise<RationaleDetail>;
  getVerificationReview(
    requestId: string,
    signal?: AbortSignal,
  ): Promise<VerificationReview>;
  openEvidence(
    requestId: string,
    evidenceId: string,
    signal?: AbortSignal,
  ): Promise<Blob>;
  downloadEvidence(
    requestId: string,
    evidenceId: string,
    signal?: AbortSignal,
  ): Promise<BlobDownload>;
  getModerationReport(
    reportId: string,
    signal?: AbortSignal,
  ): Promise<ModerationReview>;
  getSupportCase(
    caseId: string,
    signal?: AbortSignal,
  ): Promise<AdminSupportCaseDetail>;
};
```

Protected evidence methods never return a URL. `BlobDownload` contains bytes,
media type, and a safe display filename only for the current response.

## Custom command methods

Every input below also includes `expectedVersion`, `idempotencyKey`, and the
current in-memory CSRF proof. `reason` means one FR-016 category plus a normalized
10–500-character rationale.

```ts
type SmartHireAdminCommands = {
  revokeSession(
    accountId: string,
    sessionReference: string,
    reason: Reason,
  ): Promise<CommandResult>;
  revokeAllSessions(accountId: string, reason: Reason): Promise<CommandResult>;
  suspendAccount(accountId: string, reason: Reason): Promise<CommandResult>;
  reinstateAccount(accountId: string, reason: Reason): Promise<CommandResult>;

  requestVerificationChanges(
    requestId: string,
    guidance: string,
    privateNote?: string,
  ): Promise<CommandResult>;
  rejectVerification(
    requestId: string,
    category: RejectionCategory,
    visibleReason: string,
    privateNote?: string,
  ): Promise<CommandResult>;
  approveVerification(
    requestId: string,
    role: CompanyMembershipRole,
  ): Promise<CommandResult>;

  suspendMembership(
    membershipId: string,
    reason: Reason,
  ): Promise<CommandResult>;
  restoreMembership(
    membershipId: string,
    reason: Reason,
  ): Promise<CommandResult>;
  removeMembership(
    membershipId: string,
    reason: Reason,
  ): Promise<CommandResult>;

  assignReport(
    reportId: string,
    assigneeAdminUserId: string | null,
  ): Promise<CommandResult>;
  addReportNote(reportId: string, note: string): Promise<CommandResult>;
  resolveReport(reportId: string): Promise<CommandResult>;
  dismissReport(reportId: string): Promise<CommandResult>;
  linkEnforcement(
    reportId: string,
    enforcementCorrelationId: string,
  ): Promise<CommandResult>;
  claimSupportCase(caseId: string): Promise<CommandResult>;
  reassignSupportCase(
    caseId: string,
    assigneeAdminUserId: string,
    reason: "STAFF_HANDOFF" | "WORKLOAD_BALANCE" | "EXPERTISE_REQUIRED",
  ): Promise<CommandResult>;
  replySupportCase(
    caseId: string,
    content: string,
    clientOperationId: string,
  ): Promise<CommandResult>;
  noteSupportCase(caseId: string, note: string): Promise<CommandResult>;
  resolveSupportCase(caseId: string): Promise<CommandResult>;
  closeSupportCase(caseId: string): Promise<CommandResult>;
};
```

No command uses React Admin's undoable/optimistic mode. UI side effects execute
only after server success. Successful commands invalidate/refetch the narrow
affected query keys plus dashboard snapshot; they do not synthesize state.

## Auth provider contract

```ts
type AdminAuthProvider = AuthProvider & {
  login(input: {
    email: string;
    password: string;
  }): Promise<void | { redirectTo: string }>;
  checkAuth(): Promise<void>;
  checkError(error: AdminHttpError): Promise<void>;
  logout(): Promise<void>;
  getIdentity(): Promise<{ id: string; fullName: string }>;
  canAccess(input: {
    resource: string;
    action: string;
    record?: unknown;
  }): Promise<boolean>;
  completeTwoFactor(input: {
    method: "TOTP" | "BACKUP_CODE";
    code: string;
  }): Promise<void>;
  stepUp(input: {
    method: "TOTP" | "BACKUP_CODE";
    code: string;
  }): Promise<{ freshUntil: string }>;
};
```

The adapter stores no token or permission list. `canAccess` is a presentation
hint derived from current server context; direct server authorization remains
mandatory.

## Error contract

| HTTP/status code                              | Provider behavior                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `400 VALIDATION_FAILED`                       | Map allowlisted field errors to the active form; no retry                            |
| `401 AUTHENTICATION_REQUIRED`                 | Purge all memory, reject checkAuth, render login                                     |
| `401 ADMIN_SESSION_REPLACED`                  | Purge all memory, render non-sensitive replaced-session message/login                |
| `403 ADMIN_AUTHORITY_DENIED`                  | Purge protected memory and render access denied; no target data                      |
| `403 ORIGIN_DENIED`                           | Purge and render generic unavailable state                                           |
| `404 RESOURCE_UNAVAILABLE`                    | Same generic unavailable state for unknown/unauthorized non-public target            |
| `409 STATE_CONFLICT` / `412 VERSION_MISMATCH` | Render StaleConflictPanel with current safe state and require refresh/reconfirmation |
| `423 ACTION_BLOCKED`                          | Show safe invariant reason such as SELF_ACTION or LAST_OWNER; no mutation            |
| `428 STEP_UP_REQUIRED`                        | Open StepUpDialog; do not log out or send original command until proof succeeds      |
| `429 REPORT_LIMIT`                            | Reporter flow shows exact retry duration without target existence                    |
| `503 SNAPSHOT_UNAVAILABLE`                    | Dashboard shows unavailable/recalculating, never expired count                       |
| `503 VIEWER_UNAVAILABLE`                      | Review disables decisions and shows operational outage state                         |

Provider errors contain stable code, safe message key, correlation reference when
allowed, field errors when applicable, retry duration when specified, and current
safe projection only for authorized conflict responses. They exclude stack,
provider/database errors, storage/session references, evidence/report/rationale
content, and target existence on non-public denial.

## Query/store configuration

- React Admin `memoryStore()` only.
- `disableTelemetry`.
- Queries: `staleTime: 0`, inactive `gcTime: 0`, refetch on mount/focus/reconnect,
  no placeholder/previous-data display across protected route changes, no retry
  for auth/authorization/validation/not-found/conflict.
- Dashboard only: explicit 30-second refetch while visible; the server's
  `calculatedAt`/`expiresAt` is authoritative.
- Commands: `retry: false`; idempotent user retry is an explicit reconfirmed
  action using either the original key for an unknown transport outcome or a new
  key after an authoritative result.
- On route transition, AdminAuthorityGate completes checkAuth before children
  render. On logout/auth/grant/designation error, `queryClient.clear()` and store
  reset occur before navigation.
