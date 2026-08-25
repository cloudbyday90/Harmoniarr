# Selection-origin evidence outcome

**Completed:** 2026-08-25

## Delivered

- Added a nullable, database-constrained `selection_origin` field to the
  operator release-group selection record.
- The Artist Detail edition command saves `manual_edition`; the Missing Music
  inclusion command saves `manual_inclusion`.
- Preserved the value through backup/restore normalization, artist projections,
  desired-state planning, wanted-release evidence, and the existing scoped
  Music Queue response.
- Added a small ESM-only Music Queue operator-selection evidence module that
  allowlists the externally presented source, state, and origin fields.
- Updated the shared presentation helper so Artist Detail and Music Queue use
  the same labels: **Edition selected**, **Manual inclusion**, or the safe
  legacy fallback **Manual selection**.
- Added focused database-contract, service, projection, API, client, and
  browser coverage.

## Outcome

Operators can now see whether a release in Music Queue reflects a saved edition
or a manual inclusion, and can follow the same wording back to Artist Detail.
Existing manual selections remain correctly described without a fabricated
origin.

No new routes, permissions, or acquisition commands were added. The change
continues to use the existing CSRF-protected selection commands and user-scoped
Music Queue reads.

## Validation

Completed before commit:

- focused server and client tests for the persistent and presentational
  contracts;
- focused browser verification of both labels in Artist Detail and Music Queue;
- migration and schema snapshot validation;
- client lint, full test suite, ESM, copyright, and production builds.

## Next recommended item

Test the combined Music Queue and Downloader information architecture as a
read-only **Acquisition** workspace prototype before changing navigation or
moving actions. It should keep separate state lanes for selection, search,
transfer, import, and recovery while giving each release one clear next action.
