# Acquisition workspace navigation outcome

**Completed:** 2026-08-26

## Delivered

- Replaced the separate operator-sidebar **Music Queue** and **Downloader**
  entries with one **Acquisition** entry immediately after **Discover**.
- Added `AcquisitionWorkspaceView`, a small ESM Vue parent with ordinary,
  labelled route navigation for **Overview**, **Music Queue**, and the
  administrator-only **Downloader**.
- Moved the existing three focused views below `/app/acquisition`:
  - `/app/acquisition`
  - `/app/acquisition/music-queue`
  - `/app/acquisition/music-queue/:wantedReleaseId`
  - `/app/acquisition/downloader`
- Directed newly created release and transfer handoffs to those nested routes.
- Retained `/app/music-queue`, `/app/music-queue/:wantedReleaseId`, and
  `/app/downloader` as immediate redirects that preserve query strings and
  hashes.
- Added a pure ESM presentation module for role-safe Acquisition sections and
  focused unit/browser coverage for the navigation, protected visibility, and
  legacy redirects.

## Outcome

Music Queue and Downloader are now properly combined at the navigation level:
an operator enters one **Acquisition** workspace, then chooses the specific
release or transfer surface needed for the task. They are not combined into a
single dense, multi-purpose screen.

Release decisions and match recovery still belong to Music Queue. Live transfer
controls and provider diagnostics still belong to Downloader. That preserves a
clear, safe division of responsibility without leaving the user to discover
the relationship from two unrelated sidebar items.

## Accessibility and security result

- The workspace uses a labelled `nav` and native links, not tab roles for
  views that are separate URLs with independent asynchronous state.
- Secondary destinations have stable order and names on every Acquisition
  page. No view changes merely because a control receives focus.
- The Downloader link is omitted for non-administrators. The existing
  server-side authorization on the Downloader API has not changed. The router
  also redirects a requester who enters the nested Downloader URL directly
  before that protected read can load.
- Legacy redirects retain only existing route state; no provider username,
  transfer ID, or new sensitive value is introduced by this work.

## Validation evidence

Completed before commit:

- focused client navigation, route, and handoff tests: 68 passed;
- full client suite: 4,193 passed;
- `npm run lint:client`;
- `npm run build:client`;
- focused Playwright checks for the Acquisition workspace and the legacy
  Activity queue redirect, including query/hash preservation;
- `npm run validate` and `npm run validate:security`;
- rebuilt local walkthrough Compose with `build`, `up -d --wait --no-build`,
  and the one-shot bootstrap helper. The rebuilt service is healthy on
  `127.0.0.1:47956`.

## Next recommended item

Run a concise walkthrough UI acceptance pass at desktop, compact-sidebar, and
mobile breakpoints. Confirm the single Acquisition primary entry remains easy
to find and that the secondary navigation scroll affordance is visible when
space is constrained.
