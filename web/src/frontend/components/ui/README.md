# SmartHire UI primitives

Shared primitives use the semantic tokens from `src/frontend/styles/tokens.css`.
Feature composition stays inside `src/frontend/features/*/components`.

## Job detail primitives

- `Button` supports `primary`, `secondary`, `outline`, `danger`, and `ghost`. The `outline` variant uses the primary border and the primary-light surface on hover.
- `StatChip` is the shared icon/label/value treatment used by the Job hero and Overview.
- `CollapsibleCard` is a button-based disclosure. It exposes `aria-expanded` and `aria-controls`, supports Enter/Space through the native button interaction, and animates the content height.
- `ContentTabs` is the underline tab treatment for switching content inside one panel. It is separate from pill navigation such as `TopBar`/`TabsRow`.
- `ChecklistItem` is the checked square bullet used for responsibilities and requirement lists.
- `RelatedJobRow` is the shared full-width/compact related-job row with optional save action.
- `RatingRow` uses the amber rating accent. Amber is not an error state here.

## Tab rule

Use pill tabs for page-level navigation. Use underline tabs for content changes within the same panel. Do not add a single variant prop that makes one component serve both interaction models.

## Status color rule

Teal/success represents positive states broadly: active, verified, connected, saved, and similar states. Amber is reserved for warnings/review context and rating emphasis; a rating is not automatically a warning.
