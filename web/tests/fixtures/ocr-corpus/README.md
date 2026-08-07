# Feature 005 OCR Evaluation Corpus

This directory contains only synthetic or explicitly redistributable fixtures.
Real CVs, job posters, screenshots, user uploads, names, contact details,
provider payloads, credentials, and production-derived content are prohibited.

## Layout

- `images/`: generated PNG/JPEG inputs named by immutable fixture ID.
- `documents/`: generated PDF/DOCX fixtures used by the CV hybrid path.
- `truth/`: UTF-8 ground-truth text and supported search-intent labels.
- `security/`: non-personal malformed/signature/polyglot/limit fixtures.
- `manifest.json`: authoritative hashes, provenance, strata, labels, and release
  floors. Evaluation rejects files or labels not represented by the manifest.

## Provenance and review

Every fixture must declare `SYNTHETIC` or an allowlisted redistributable license,
its generator/source class, SHA-256, independent label reviewer, language,
purpose, layout, quality, security categories, and ground-truth word count.
Generated identities and contact details must use reserved example values.

Fixtures may count toward several strata, but the release requires at least 180
unique fixtures and 18,000 labeled words. Zero-text rejection fixtures count
only toward the security fixture floor and are reported separately from OCR
word accuracy. The text-bearing security subset must still provide 1,000 words.

## Truth format

Text truth is NFC UTF-8 with LF line endings. Evaluation applies NFKC and
whitespace normalization while preserving Vietnamese diacritics. Intent truth
uses only Feature 003 fields and records expected field, typed value, selection
state, basis, and Unicode code-point evidence ranges. Job IDs, sorting/ranking,
private fields, and actions are forbidden.

No generated artifact in this directory may be reused as a production demo or
treated as evidence until its hash and reviewer entry are frozen in the
manifest.
