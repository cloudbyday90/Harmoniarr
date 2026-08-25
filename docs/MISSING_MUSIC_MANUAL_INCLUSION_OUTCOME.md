# Missing Music manual inclusion outcome

**Completed:** 2026-08-25

## Delivered

- Added `operator-artist-manual-inclusion-service.js`, a small ESM command
  service that creates a manual inclusion only from the current, user-scoped
  artist projection.
- Added a protected `POST` route for the command. It uses the existing
  fresh-session and CSRF guard, scopes every change to the signed-in user, and
  responds with `202` only when reconciliation has been queued.
- Routed the command through `saveOperatorArtist`, so existing manual
  selections and track overrides are retained and all durable updates continue
  through the snapshot/reconciliation/activity path.
- Added a Missing Music card action, **Keep selected manually**, with a
  labelled confirmation dialog. The dialog states the exact effect: save a
  manual inclusion, queue reconciliation, and do not start a search.
- Added an explicit manual-selection pill and a client-side composable that
  prevents duplicate submissions while eventual reconciliation updates the
  workspace.

## Security and integrity outcome

The browser supplies only the release identity needed to identify the current
card. The service, rather than the browser, reads the authoritative
projection, checks monitored ownership and release-group membership, and builds
the complete draft. It rejects stale policy state and conflicting manual
choices. Repeating an already-saved identical manual inclusion is idempotent
and creates no additional snapshot or reconciliation run.

This avoids the two unsafe alternatives: a direct low-level selection write or
a browser-authored full artist draft.

## Accessibility outcome

The control has visible, outcome-oriented wording. Its confirmation reuses the
native dialog with an explicit heading, contained keyboard interaction, close
control, and focus restoration. Success and failure are emitted through the
existing status/toast path rather than moving focus away from the operator's
place in the grid.

## Validation

Focused coverage was added for:

- full snapshot-draft construction and preservation of unrelated overrides;
- idempotent repeat handling;
- stale/conflicting selection rejection;
- route session/CSRF use and response contract;
- client request identity, duplicate prevention, and error handling;
- wanted-release normalization for manual-selection presentation.

Broader validation and final repository evidence are recorded with the commit
that implements this document:

- `npm test` — lint, test hygiene, server, client, scripts, and integration
  suites all passed;
- `npm run build` — client and server production builds passed;
- `npm run check:esm` — the managed ESM source scan passed;
- `node --test test/browser/missing-card-grid-keyboard-roving.test.js` —
  keyboard roving, confirmation focus, exact mutation payload, and manual
  inclusion feedback passed.
