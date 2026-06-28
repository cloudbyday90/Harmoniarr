# Wanted Import Review Workflow State Design

Status: Implemented
Date: 2026-06-27

## Purpose

Wanted rows can now link to Import Review candidates produced by discovery.
The next gap was visibility after an operator reviews those candidates. A row
could say `1 candidate` even after that candidate was selected, downloading,
ready to import, failed, or applied.

This design adds a bounded Import Review workflow summary to each
candidate-producing Wanted row so operators can tell where acquisition is stuck
without opening Import Review first.

## Research Summary

- PostgreSQL aggregate functions support compact count and JSON object
  projections from a related set. That fits a status-count summary better than
  returning candidate rows to the Wanted table.
- PostgreSQL table expressions support lateral subqueries, which lets the
  wanted read model correlate the discovery `lastSearchId` to matching
  candidate statuses without changing schema.
- Vue computed values are the right client boundary for deriving row
  presentation state from fetched data.
- Playwright recommends role and text locators for user-facing browser proof.
- OWASP API authorization guidance warns against leaking object properties that
  are not needed by a caller. The Wanted row should expose only aggregate
  candidate workflow state, not raw provider payloads, paths, peer names, or API
  details.

## Options Considered

### Option A: Leave workflow state only in Import Review

Pros:

- No backend changes.
- Import Review remains the only detailed workflow surface.

Cons:

- Wanted rows remain ambiguous after a candidate is selected.
- Operators must open Import Review to know whether acquisition is pending,
  selected, downloading, failed, or waiting for import.

### Option B: Attach full matching candidate rows to Wanted releases

Pros:

- Maximum row-level detail.
- No secondary lookup after page load.

Cons:

- Exposes unnecessary provider and peer data in the Wanted API.
- Bloats a high-level operational table.
- Couples Wanted to Import Review's detailed candidate payload shape.

### Option C: Attach a bounded candidate status aggregate

Pros:

- Shows workflow state where the operator needs it.
- Keeps the response small and stable.
- Reuses `import_candidates.source_search_id` and the existing discovery
  evidence contract.
- Avoids exposing candidate payloads, peer usernames, folder paths, file lists,
  or provider response details.

Cons:

- Does not show exact candidate detail; operators still open Import Review for
  files and actions.
- If candidates are later deleted, the aggregate disappears and the row falls
  back to discovery-result-only copy.

## Final Recommendation

Use Option C.

Add `discoveryRequest.importReviewSummary` to the admin Wanted read path. The
summary contains only:

- `totalCount`
- `statusCounts`
- `latestStatus`
- `latestUpdatedAt`

Then use a pure client presenter to choose a scan-friendly workflow label:

1. `Downloading`
2. `Ready to import`
3. `Selected for download`
4. `Candidate failed`
5. `Held for review`
6. `Pending review`
7. `Applied`
8. `Rejected`

Active and problem states take priority over stale latest-status ordering.

## Security Notes

- The summary stays behind the existing admin-only discovery detail flag on
  `GET /api/v1/library/wanted-releases`.
- The aggregate does not expose usernames, folder paths, file names, raw
  provider payloads, normalized provider payloads, API keys, or search query
  text.
- No new route, mutation, or authorization surface is introduced.

## Implementation Outcome

- `library-wanted-release-store.js` now uses a lateral aggregate over
  `import_candidates` for the discovery `lastSearchId`.
- `wanted-release-normalization.js` now exposes
  `buildImportReviewWorkflowResult()`.
- `ActivityWantedView.vue` renders a compact workflow state below the Discovery
  result when candidate workflow state exists.
- The Wanted browser fixture seeds a selected candidate and the matching
  workflow aggregate.
- The Activity Wanted browser scenario proves the row shows `Selected for
  download` before opening the matching Import Review queue.

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
