# Artist Detail manual edition selection outcome

**Completed:** 2026-08-25

## Delivered

- Added a modular manual-edition selection command that derives the complete
  operator draft on the server and persists it through the existing
  snapshot/reconciliation workflow.
- Added optimistic snapshot-revision protection to the canonical artist save
  service and used it for both direct manual-selection commands.
- Added a fresh-session, CSRF-protected route that returns the updated
  user-scoped artist projection.
- Reworked the release dialog's edition preview into a native radio group with
  concise edition comparison facts and a distinct **Use this edition** action.
- Kept global metadata canonicalization separate from the operator's desired
  edition selection.
- Prevented edition switching when the release has a partial selection or
  track overrides, or when Artist Policy has unsaved changes.

## Security and accessibility outcome

The browser cannot submit a complete artist policy to this direct mutation. It
can identify only the edition it displayed and the snapshot revision it saw.
The server confirms user scope, artist ownership, release-group membership,
and revision freshness before deriving the persistence draft. The canonical
save transaction verifies the revision again after taking its row lock.

The edition preview uses a labelled native radio group. The action names its
effect, explains that it queues reconciliation rather than starting a search,
and reports success or failure through the existing status/toast path without
moving focus away from the dialog.

## Validation

Completed before commit:

- focused server tests for the manual-selection services, artist save, route
  registration, and metadata-module wiring (47 passing);
- focused client API, composable, and release-detail tests (34 passing);
- client, server, and test ESLint checks with zero warnings;
- production client build;
- browser verification for focus containment, native radio edition preview,
  track override behavior, and the new manual-edition save path (2 passing).

Final validation also passed:

- `npm test`: lint, test hygiene, server, client, script, and 35 serial
  integration tests;
- `npm run check:esm`;
- `npm run build` for the production client and server bundles.

## Open pull request assessment

The local GitHub CLI credential could not retrieve live pull-request state, so
the available cached `origin/pr-*` refs were evaluated without merging.

- PR #23 and #24 would regress already newer pinned GitHub Actions versions.
- PR #36 and #39 would downgrade dependencies and remove existing structural
  and lifecycle safeguards.
- PR #40 updates only a disposable controlled-provider fixture to Node 26
  Current. Node.js recommends production applications use an Active or
  Maintenance LTS line; Harmoniarr's application runtime is therefore not
  aligned to that Current-only change. It was not applied.

No open PR was applicable to this slice. The command is local and user-scoped;
it changes neither shared metadata nor the self-hosted Compose topology.
