# Acquisition overview outcome

**Completed:** 2026-08-25

## Delivered

- Added a read-only `/app/acquisition` overview route without changing the
  established primary navigation.
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

Music Queue and Downloader remain the source-of-truth workspaces. This keeps
the Sonarr/Radarr-style release workflow and SABnzbd-style transfer diagnostics
complementary without turning either into an overloaded all-in-one screen.

## Validation

Completed before commit:

- focused client presentation and composable tests;
- focused browser verification of the read-only overview and handoffs;
- client lint, full tests, ESM consistency, copyright, and production build.

## Next recommended item

After operators use the overview, add durable, explicit release-to-transfer
correlation from the existing import execution record. That would permit a
single release row to show verified transfer progress without filename-based
guessing or widening visibility across users.
