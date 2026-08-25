# Manual selection and Music Queue visibility outcome

**Completed:** 2026-08-25

## Delivered

- Preserved durable manual-selection provenance and metadata release-group
  correlation in the normalized Music Queue client read model.
- Added a small, ESM-only presentation module for manual selection,
  reconciliation wording, and exact release-group correlation.
- Added a **Manual selection** status to Artist Detail release cards and the
  matching Music Queue release row.
- Added contextual reconciliation wording on Artist Detail for queued,
  running, and failed reconciliation states without implying that a download
  has started.
- Added an optional, descriptive Artist Detail link to the exact Music Queue
  release once it exists.
- Refreshed the artist-scoped Music Queue read after a successful manual
  edition save; a failed refresh does not undo or misreport the saved choice.

## Accessibility and security outcome

The new provenance status is ordinary semantic text, while only changing
reconciliation information uses `role="status"`. The direct queue handoff is a
native link beside, rather than inside, the release-card detail control, and
its accessible name includes the release title and Music Queue destination.

This release adds no state-changing endpoint. It reuses data already scoped by
the existing authenticated Music Queue API, and leaves the original
fresh-session, CSRF-protected manual-selection command untouched.

## Validation

Completed before commit:

- focused client presentation tests for normalization, manual-selection
  visibility, and Music Queue row facts;
- focused browser verification for the visible Artist Detail and Music Queue
  states and the descriptive handoff;
- client lint and production build;
- full project test suite, ESM check, and production build.

## Open pull request assessment

The local GitHub CLI credential could not retrieve live pull-request state.
Available cached `origin/pr-*` refs were assessed locally without merging.
No cached pull request was applicable: the action and dependency updates would
regress newer pins or remove safeguards, while the Node 26 change targets only
a controlled-provider fixture and conflicts with the documented Node 24 LTS
runtime policy.

## Next recommended item

Add a small, explicit **selection origin** field to the server's Music Queue
evidence only if the product needs to distinguish manual-edition selection from
manual inclusion. Until then, **Manual selection** is the accurate, stable
user-facing label for both paths.
