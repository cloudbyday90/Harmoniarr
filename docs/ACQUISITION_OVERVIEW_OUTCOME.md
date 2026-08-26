# Acquisition overview outcome

**Completed:** 2026-08-25

> **Superseded navigation note (2026-08-26):** This outcome accurately records
> the first overview slice, but its separate primary-navigation model is no
> longer the product direction. See
> [Acquisition workspace navigation outcome](ACQUISITION_WORKSPACE_NAVIGATION_OUTCOME.md).

## Delivered

- Added a read-only `/app/acquisition` overview route. It was initially
  unlisted in primary navigation; it is now the entry point for the unified
  Acquisition workspace.
- Added modular ESM client presentation and composable layers that compose the
  existing Music Queue and Downloader read models with independent SWR refresh
  state.
- Kept the release lane and transfer lane separate, with explicit links to the
  existing owning workspaces rather than duplicated controls.
- Added an administrator-only Downloader fetch/render guard while leaving the
  server-side admin requirement unchanged.
- Added focused unit and browser coverage for the overview, source-workspace
  handoffs, and role-safe download visibility.

## Outcome

Administrators can now start at a compact Acquisition overview to answer two
questions: which releases are moving or have a clear next step, and which
downloads are currently active or queued. They can then explicitly open the
release inspector or Downloader detail they need.

Music Queue and Downloader remain the source-of-truth workspaces. The later
Acquisition workspace change makes them one navigation domain without turning
either into an overloaded all-in-one screen.

## Validation

Completed before commit:

- focused client presentation and composable tests;
- focused browser verification of the read-only overview and handoffs;
- client lint, full tests, ESM consistency, copyright, and production build.

## Next recommended item

Implemented on 2026-08-26 in
[Acquisition release-to-transfer correlation outcome](ACQUISITION_RELEASE_TRANSFER_CORRELATION_OUTCOME.md).
The next item is operator-authorized strict local provider acceptance: confirm
the durable linkage survives a real Music Queue -> Downloader transfer without
manufacturing provider activity during validation.
