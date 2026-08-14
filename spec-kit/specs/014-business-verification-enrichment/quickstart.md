# Quickstart: Business Verification Enrichment

## Prerequisites

- Node.js 24.18.0 and repository dependencies installed.
- PostgreSQL and ClamAV available through the existing local Compose setup.
- Existing email worker configuration available for challenge delivery.
- No paid registry credential is required.

## Environment

Local development enables VietQR with:

```text
BUSINESS_REGISTRY_PROVIDER=vietqr
```

To test fail-closed provider handling, temporarily use:

```text
BUSINESS_REGISTRY_PROVIDER=disabled
```

`vietqr` enables the initial public adapter. `disabled` deterministically returns an unavailable outcome and must keep steps two onward locked.

Optional bounded configuration keeps safe defaults when omitted:

```text
BUSINESS_REGISTRY_TIMEOUT_MS=4000
BUSINESS_REGISTRY_RESPONSE_LIMIT_BYTES=65536
```

## Database

```powershell
npm run db:validate
npm run db:migrate
npm run db:generate
npm run business-verification:migration:verify --workspace @smarthire/web
```

The migration is additive. Do not fabricate enriched facts for legacy requests.

## Run Locally

```powershell
npm run dev
```

Candidate page:

```text
http://localhost:3001/dashboard/employer-verification
```

Administrator verification resource:

```text
http://console.admin.localhost:3001/#/verification-requests
```

## Manual Acceptance Flow

1. Sign in as an active Candidate.
2. Enter a ten-digit enterprise tax identifier and run lookup.
3. Confirm the matched identifier is read-only; use `Change tax identifier` and verify all business, email, and draft progress disappears before the identifier unlocks.
4. Repeat lookup with an unknown identifier and with `BUSINESS_REGISTRY_PROVIDER=disabled`; confirm no business-information, email, evidence, or submission section becomes available.
5. Enter a company email, request verification, and inspect the local email sink/worker output.
6. Open the fragment-based verification link while signed in as the same Candidate; confirm the fragment is removed and the page shows verified status.
7. Enter phone, optional website, relationship, title, required explanations, declarations, and a supported business-license file.
8. Submit twice rapidly; confirm one active request, one evidence version, and one receipt exist.
9. Open admin detail and confirm the checklist, applicant/registry values, differences, email/domain signals, unverified phone, relationship, and consent are clearly separated.
10. Confirm the current business-license metadata and safety checks are visible, preview the normalized document, then open the authenticated full PDF/image in a separate tab.
11. Confirm no lookup or contact signal automatically approves or rejects the request.

## Focused Validation

```powershell
npm run test:business-verification --workspace @smarthire/web
npm run typecheck --workspace @smarthire/web
npm run lint --workspace @smarthire/web
npm run build --workspace @smarthire/web
```

Provider tests must mock HTTP and must not require live VietQR availability. A live lookup is an optional manual smoke test only.

## Privacy Checks

- Search logs and test snapshots for raw verification tokens, raw provider JSON, evidence locators, and full recipient addresses.
- Confirm challenge links put the token after `#`, not in a query string.
- Confirm `GET preparation` and all confirmation responses use `Cache-Control: private, no-store`.
- Confirm browser local/session storage contains no token, document bytes, provider payload, or contact verification response.
- Confirm terminal challenges scrub `normalizedEmail` and `tokenDigest` on schedule.

## Provider Disable/Replacement Drill

1. Set `BUSINESS_REGISTRY_PROVIDER=disabled` and restart the server.
2. Verify lookup returns `UNAVAILABLE` with retry guidance and every later preparation step remains locked.
3. Verify direct draft PATCH, email challenge, and final submission attempts fail with `LOOKUP_REQUIRED`.
4. To replace the provider, implement `BusinessRegistryLookupGateway`, register it in the server-only composition root, add mocked contract tests, and update the reviewed provider/source/version documentation. No route, service, or UI contract should require provider-specific changes.
