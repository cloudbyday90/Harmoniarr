# Music Queue Release-Scoped Downloader Handoff Outcome

Status: Implemented

Date: 2026-08-25

## Delivered Outcome

A downloading Music Queue release now uses **View download progress** instead
of a generic **Open Downloader** action. The link is scoped to the release and
has an accessible name such as **View download progress for Forest Frank —
Child of God**.

Downloader reads the durable `wantedReleaseId` route parameter, filters its
existing live queue projection to matching linked transfers, and shows a
short **Music Queue transfer** explanation with two bounded navigation
choices:

- **Open release in Music Queue** returns to the release lifecycle and its
  decisions.
- **Show all transfers** removes only the release scope and leaves any direct
  transfer-detail query intact.

When a transfer is no longer live, the empty state explains that it may not
have started, may have completed, or may have aged out of the live queue. It
does not guess at an operational repair or reveal provider diagnostics.

## Implementation Outcome

- `music-queue-downloader-handoff.js` is a pure ESM builder for the
  Music Queue -> Downloader location, visible label, accessible label, and
  boundary copy.
- `downloader-music-queue-handoff-route.js` is a separate ESM module for
  reading and clearing just the release-scoped query parameter.
- `downloader-transfer-filter.js` adds exact durable release-ID filtering to
  the existing local state/linkage filter composition.
- Music Queue rows and the release inspector use the same handoff builder,
  preserving label consistency and preventing duplicated route rules.
- Downloader keeps state filtering available but hides the redundant broad
  “linked to Music Queue” checkbox while a release scope is active.

## Security and Accessibility Outcome

- The URL contains only Harmoniarr's durable wanted-release ID; no provider
  transfer identity, username, filename, directory, candidate payload, or
  credential crosses the view boundary.
- The scoped view operates only on the queue data the server already authorized
  for the current user.
- The main control has clear visible text, and its accessible name starts with
  the visible label before adding the release identity.
- The filter uses no local storage, telemetry, persistence, background work,
  or new API endpoint.

## Validation Evidence

- Focused client lint passed.
- Focused tests cover the new handoff, query isolation, exact release filtering,
  scoped count copy, and review-panel ownership copy.
- The automatic Music Queue handoff browser scenario now verifies a
  release-specific URL, the scoped Downloader heading/count, absence of an
  unrelated transfer, and retained native transfer progress.

## Next Recommended Item

Complete the third agreed item: redesign **Missing** as the manual release
decision workspace. A release there should make one clear choice—accept the
automatic plan, choose a match manually, or defer—then hand the confirmed
selection to Downloader. Start with explicit release-state and action-copy
design; do not add a bulk **Request** action until it has a confirmation and
an idempotent server contract.
