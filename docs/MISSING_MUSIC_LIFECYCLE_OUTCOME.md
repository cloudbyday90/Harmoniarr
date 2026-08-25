# Missing Music Lifecycle Outcome

Date: 2026-08-25

## Implemented outcome

The wanted-release projection no longer independently queries monitoring,
release, and reconciliation tables to decide what is selected. It now uses the
same modular selection path as artist reconciliation:

1. Read the monitored-artist snapshot.
2. Read the artist's metadata, explicit release-group selections, and track
   overrides.
3. Build effective release groups.
4. Build the desired-state plan.
5. Project selected, incomplete releases into `library_wanted_releases`.

This corrects the prior drift where a manual selection could be valid in artist
detail and reconciliation but absent from Missing Music because the SQL query
excluded `track_only` and `manual_only` policies wholesale.

## Code changes

- Added `library-wanted-release-projection-service.js`, a focused projection
  module that records selection source/state alongside coverage evidence.
- Reworked `library-wanted-release-service.js` into an orchestration service
  with injected read boundaries and a bounded six-artist concurrency limit.
- Omitted acquired (`complete` and `duplicate`) releases and releases without a
  usable track count. Explicit selections continue through policy gates;
  ordinary policy selections retain the desired-state eligibility rules.
- Renamed the operator surface to **Missing music** and replaced opaque labels:
  `Selected releases`, `Not in library`, and `Some tracks missing`.
- Made the card action and confirmation dialog explicit: **Start search** adds
  the release to Music Queue using the existing protected request flow.
- Replaced `Download recovery needs review` with `Search stopped` and the
  actionable `Search again` control.
- Corrected the Missing Music confirmation modal bindings so loading,
  completion, and error state reach the dialog's declared props.

## Validation contract

Focused server tests prove:

- a manual selection survives `manual_only` and `track_only` policy gates;
- policy-selected releases retain partial reconciliation counts;
- the service uses injected metadata, selection, override, and reconciliation
  boundaries rather than direct policy SQL;
- no monitored artists clears stale wanted rows; and
- a metadata deletion race is tolerated without hiding other failures.

Client and browser tests cover the descriptive labels, accessible list name,
and the renamed recovery action. Validation completed successfully:

- `npm run lint`
- `npm run check:esm`
- `npm run build`
- `npm run test:server` — 3,104 passing tests
- `npm run test:client` — 4,137 passing tests
- `npm run test:scripts` — 234 passing tests
- `npm run test:integration` — 35 passing tests
- focused Playwright coverage for Missing Music and Activity Wanted

## Deliberately not changed

Missing Music does not yet provide a new direct selection editor. Artist detail
remains the only authoring surface for selection. This avoids creating a
low-level write path that would bypass the durable snapshot, reconciliation
run, activity trail, and downstream idempotency safeguards.

Downloader also remains a separate live-transfer workspace. The page is not a
second queue: Music Queue owns release progression and decisions, while
Downloader owns transfer diagnostics and supported transfer controls.

## Next item

Build a narrow **Select release** command for Missing Music. It should open a
release picker or detail view, save through the existing artist snapshot
service, enqueue reconciliation, and then return to Missing Music with the
selected release's search state. The command must be permission-checked,
CSRF-protected, idempotent, and covered by route, service, and browser tests.
