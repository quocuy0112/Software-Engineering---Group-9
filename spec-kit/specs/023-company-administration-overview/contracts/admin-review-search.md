# Administrator Review Search Contract

## Inputs

Both administrator list endpoints accept an optional `q` query value from the
React Admin always-visible search field.

- Maximum raw length: 160 characters.
- Normalization: trim, collapse internal whitespace, Unicode lowercasing, and
  Vietnamese-diacritic removal.
- Tokenization: one to eight non-empty tokens.

## Matching behavior

| Resource | Exact matches | Tolerant name matches |
|---|---|---|
| Verification Requests | request ID, applicant ID, target-company ID, tax code | every normalized token occurs in the submitted-company name or applicant name |
| Job Post Reviews | review ID, job ID, company ID | every normalized token occurs in the persisted normalized job title or company display name |

Exact matches are OR alternatives to name matches. Name matching is
case-insensitive, diacritic-insensitive, and token-based; it is applied before
state, assignment, and pagination constraints.

## Non-goals

Search does not rank results, search private notes/evidence, expose new fields,
or change authorization. It does not mutate review or verification state.
