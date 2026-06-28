# Downloader Correlation From Import Review Execution Design

Status: Implemented
Date: 2026-06-27

## Purpose

Wanted rows can now show discovery results and Import Review candidate workflow
state. The remaining ambiguity was whether a selected candidate actually reached
the Downloader queue. A row could say `Downloading` without telling the
operator whether Harmoniarr had successfully enqueued transfers with the
download provider or failed before transfer creation.

This design adds a bounded download-execution summary to the existing Wanted
read path. The row can now distinguish:

- candidate selected but not executed yet
- candidate blocked before Downloader enqueue
- enqueue failed before reaching Downloader
- transfers accepted by Downloader
- transfers accepted with warnings

## Research Summary

- PostgreSQL JSON operators and functions support bounded extraction from
  persisted execution snapshots, including guarded JSON-array length checks.
- PostgreSQL lateral table expressions let the Wanted read model derive
  execution evidence for the current discovery search without adding schema or
  a second client request.
- slskd configuration and API-key setup are operator-managed provider details;
  Wanted should not expose raw provider credentials or full provider payloads.
- OWASP object-property authorization guidance favors exposing only properties
  needed for the caller's task. Here that means counts and statuses, not raw
  transfer filenames, provider errors, or peer payloads.
- Playwright role/text locators remain the browser-proof standard for verifying
  the operator-visible state.

## Options Considered

### Option A: Keep transfer correlation only in Import Review execution detail

Pros:

- No additional Wanted read-model work.
- Execution detail remains the full diagnostic surface.

Cons:

- Wanted rows still cannot explain whether selected candidates reached the
  Downloader.
- Operators must open Import Review to distinguish selected, blocked,
  queued, and queue-failed states.

### Option B: Join live Downloader rows directly into Wanted

Pros:

- Could show real-time transfer state on each Wanted row.

Cons:

- Couples Wanted to a live provider poll.
- Reintroduces unwanted polling pressure and setup-state edge cases.
- Makes Wanted availability depend on slskd even when persisted execution
  evidence is enough.

### Option C: Project persisted execution enqueue evidence

Pros:

- Uses the existing `import_execution_run_items.planning_snapshot.execution`
  evidence written by the execution worker.
- Shows whether transfers were accepted by Downloader without polling slskd.
- Keeps Wanted bounded to counts and statuses.
- Avoids schema changes and avoids exposing file paths, peer usernames, or
  provider error bodies.

Cons:

- It proves enqueue handoff, not live transfer progress.
- Live transfer state still belongs in Downloader and Import Review execution
  detail.

## Final Recommendation

Use Option C.

For each candidate-producing Wanted row, derive the latest execution item per
candidate from the matching discovery `sourceSearchId`. Expose only:

- `totalItemCount`
- `itemStatusCounts`
- `latestItemStatus`
- `latestUpdatedAt`
- `enqueuedTransferCount`
- `failedFilenameCount`

The client presenter should prefer this execution evidence over generic
candidate status when it exists.

## Security Notes

- The projection remains behind the existing admin-only discovery detail path.
- The API does not expose transfer filenames, remote folders, peer usernames,
  raw slskd payloads, provider exceptions, API keys, or request bodies.
- No mutation route is added.
- Live provider polling remains in the Downloader route and is still disabled
  when Soulseek is not configured.

## Implementation Outcome

- `library-wanted-release-store.js` now aggregates latest
  `import_execution_run_items` by candidate for the discovery `lastSearchId`.
- `buildImportReviewWorkflowResult()` now reports `Queued in Downloader`,
  `Queued with warnings`, `Download blocked`, and `Download queue failed` from
  persisted execution evidence.
- The Wanted browser fixture seeds a candidate whose transfer was accepted by
  Downloader.
- The Activity Wanted browser scenario proves the row shows
  `Queued in Downloader` before opening the linked Import Review queue.

## Validation

Focused validation:

- `node --test test/server/library-wanted-release-store.test.js test/server/library-wanted-summary-service.test.js`
- `node --test test/client/wanted-release-normalization.test.js test/client/wanted-discovery-candidate-link.test.js`
- `npm run build:client`
- `node --test --test-concurrency=1 test/browser/activity-releases-wanted-browser-verification.test.js`
- `npm run lint:server`
- `npm run lint:client`
- `npm run lint:test`
- `git diff --check`
