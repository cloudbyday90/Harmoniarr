# Import Execution Transfer Link Outcome

Status: Implemented
Date: 2026-08-25

## Delivered Outcome

Harmoniarr now persists a provider-confirmed transfer link for each accepted
slskd transfer. Downloader reads those links directly to recover the associated
Import Review candidate and execution state. The prior read-time expansion of
execution snapshot JSON is no longer used for this purpose.

The change is intentionally narrow:

- no queue or Downloader navigation is combined;
- no public mutation endpoint is added;
- no provider request is retried;
- no raw filename, filesystem-path, provider-secret, or raw-payload field is
  added to the link;
- the existing admin-only Downloader authorization boundary remains unchanged.

## Implementation Outcome

- Added an additive migration and schema-snapshot entry for
  `import_execution_transfer_links`.
- Added a modular ESM transfer-link store that validates, inserts, reads back,
  and verifies provider identity ownership before treating a repeated write as
  successful.
- Wired the Import Review execution worker to save links after normal accepted
  enqueue responses and recovered interrupted handoffs.
- Reworked Downloader linkage to query durable links instead of expanding
  `planning_snapshot.execution.enqueuedTransfers`.
- Added focused tests for store behavior, worker write points, and the new
  Downloader query contract.

## Validation

Run during implementation:

- focused transfer-link store, execution-worker, and Downloader-linkage tests;
- migration and schema snapshot checks;
- lint, ESM consistency, full test suite, and production build;
- open-PR applicability assessment before commit.

## Next Recommended Item

Use the durable transfer evidence in the Music Queue detail pane: present a
small, ordered progress summary for a selected release, with clear actions only
for states that require a choice. Preserve current keyboard focus when transfer
state refreshes and announce concise updates using the WCAG status-message
pattern. This gives the queue a useful Sonarr/Radarr-style lifecycle view while
leaving Downloader as the provider-operations view.
