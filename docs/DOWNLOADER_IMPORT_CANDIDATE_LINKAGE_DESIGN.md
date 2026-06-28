# Downloader Import Candidate Linkage Design

Status: Implemented
Date: 2026-06-27

## Purpose

Downloader rows are live slskd transfer observations. Before this change, every
row exposed `importLinkage.status = not_linked`, even when Import Review had
created the transfer. That forced operators to mentally connect Downloader rows
back to Import Review execution detail.

This design links live Downloader rows to Import Review candidates when the
transfer was queued by Harmoniarr's Import Review execution worker.

## Research Summary

- PostgreSQL JSON functions support set-returning extraction from JSONB arrays,
  including `jsonb_to_recordset` and `jsonb_array_elements`, which lets the
  server correlate bounded transfer identifiers from persisted execution
  snapshots without string parsing.
- PostgreSQL lateral table expressions are appropriate when each persisted
  execution row needs per-row expansion of nested JSONB transfer evidence.
- Vue Router recommends named-route navigation with structured query objects,
  matching the existing Import Review `candidate` query contract.
- OWASP API object-property authorization guidance favors returning only the
  fields needed for the current task. Downloader linkage therefore exposes
  candidate/run identifiers and statuses, not raw `planning_snapshot`, paths,
  provider exceptions, API keys, or remote peer payloads.
- slskd remains an operator-configured provider. The linkage is derived from
  Harmoniarr execution evidence and does not require extra slskd polling.

Sources:

- PostgreSQL JSON functions and operators: https://www.postgresql.org/docs/current/functions-json.html
- PostgreSQL table expressions and `LATERAL`: https://www.postgresql.org/docs/current/queries-table-expressions.html
- Vue Router programmatic navigation: https://router.vuejs.org/guide/essentials/navigation.html
- OWASP API3:2023 Broken Object Property Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/
- slskd configuration: https://github.com/slskd/slskd/blob/master/docs/config.md

## Options Considered

### Option A: Keep linkage only in Import Review

Pros:

- No Downloader read-path changes.
- Import Review remains the complete workflow detail surface.

Cons:

- Downloader rows still appear disconnected from the workflow that created
  them.
- Operators must open Import Review manually to determine candidate context.

### Option B: Store a dedicated transfer-to-candidate table

Pros:

- Fast and explicit lookup path.
- Easier to index heavily as transfer volume grows.

Cons:

- Adds schema and write-path complexity before the current volume requires it.
- Duplicates evidence already persisted in execution-run item snapshots.

### Option C: Project bounded linkage from persisted execution snapshots

Pros:

- Uses existing `import_execution_run_items.planning_snapshot.execution`
  evidence written when Import Review queues transfers.
- Avoids new schema.
- Keeps live Downloader polling independent from Import Review.
- Exposes a small, task-specific diagnostics contract.

Cons:

- Correlation depends on slskd `username` plus transfer `id` being present in
  both the live provider row and the persisted execution item.
- The query expands JSONB arrays at read time; a future high-volume queue may
  justify a dedicated table.

## Final Recommendation

Use Option C now.

The Downloader queue read model should:

- flatten live slskd groups into transfer rows
- build a transfer key from `username` and transfer `id`
- ask a modular linkage service for matching Import Review candidate evidence
- expose only bounded `diagnostics.importLinkage` fields
- render `Open candidate` links when a candidate is linked

## Security Notes

- The existing Downloader route remains admin-only.
- Linkage output does not include raw slskd rows, filesystem paths, remote
  folders, provider exceptions, raw execution snapshots, API keys, or request
  bodies.
- The SQL query uses parameterized JSON input.
- The disabled-provider path still does not call slskd or the linkage lookup.
- The client uses the existing Import Review route contract instead of creating
  a new privileged route.

## Implementation Outcome

- Added `downloader-import-candidate-linkage-service.js`, a modular ESM service
  that correlates transfer `{ username, id }` pairs to latest Import Review
  execution items through bounded JSONB projection.
- `downloader-queue-read-model-service.js` now enriches normalized transfer
  diagnostics with linked candidate context when available.
- `downloader-transfer-policy.js` now emits either `linked` or `not_linked`
  import linkage diagnostics.
- Added `downloader-import-review-link.js` for client-side Import Review route
  construction.
- `DownloaderView.vue` now renders row-level `Open candidate` links for linked
  transfers.
- `DownloaderTransferDetailDrawer.vue` now exposes the same handoff in the
  diagnostics contract section.
- `DOWNLOADER_LINKED_TRANSFER_BROWSER_VERIFICATION_DESIGN.md` adds the
  browser proof for the row and drawer handoffs, and fixes the native dialog
  open path discovered by that scenario.

## Validation

Focused validation:

- `node --test test/server/downloader-import-candidate-linkage-service.test.js test/server/downloader-queue-read-model-service.test.js`
- `node --test test/client/downloader-import-review-link.test.js test/client/downloader-detail-drawer-contract.test.js`
- `node --test --test-concurrency=1 test/browser/downloader-import-candidate-linkage-browser-verification.test.js`
