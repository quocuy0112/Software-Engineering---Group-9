# Synthetic CV fixtures

These fixtures contain generated, non-personal test data only. They exercise the
Feature 004 security envelope and must never be replaced with a real CV.

- `clean/`: minimal PDF/DOCX descriptors used to build clean documents in tests.
- `malicious/`: inert descriptors for EICAR, polyglot, traversal, active-content,
  encrypted, embedded, image-only, expansion-limit, and malformed cases.
- `parser/`: deterministic segment/parser-output fixtures, including text that
  looks like prompt instructions but remains untrusted CV data.

Binary documents are constructed in memory by the extraction fixture builder so
the repository never stores executable macros or a live malware sample.
