# Request Pipeline Import Readiness Design

## Problem

The local walkthrough proved that the request pipeline can advance farther than
the UI made clear:

- monitored artist policy created wanted releases
- discovery dispatched Soulseek searches
- Import Review candidates were persisted
- one candidate was selected and sent to slskd
- slskd reported completed transfers
- Harmoniarr still could not see files in its mounted download tree

The operator-facing symptom was confusing: Downloader and Import Review could
look idle or blank even though durable execution evidence existed. The root
cause in the live walkthrough state was an empty `paths.downloadMappings`
setting combined with completed slskd paths that were not visible inside the
Harmoniarr container.

## Live Findings

- `library_wanted_releases`: wanted rows existed and remained missing.
- `library_discovery_requests`: discovery rows existed, mostly cooling down or
  exhausted after searches.
- `import_candidates`: hundreds of slskd candidates were persisted.
- `import_execution_run_items`: one run item recorded provider acceptance and
  completed transfer snapshots.
- `import_candidates.status`: one candidate reached `import_pending`.
- `/data/downloads`, `/data/music`, and `/data/staging` inside Harmoniarr were
  empty.
- `app_settings.paths.downloadMappings` was `[]`.

That means the failed stage was not search or provider enqueue. It was import
readiness: completed files were not reachable from the resolved source path.

## Options

### Keep Activity Imports as a thin raw candidate table

Pros:

- Minimal surface area.
- Keeps `/activity/imports` independent from Import Review.

Cons:

- Hides path-mapping blockers.
- Does not explain why completed provider transfers are not importable.
- Leaves operators to infer state from slskd logs and database rows.

### Redirect Activity Imports to Import Review

Pros:

- One canonical workflow surface.
- Avoids duplicating summary logic.

Cons:

- Removes the Activity tab as a quick operational status view.
- Breaks the current Activity workspace mental model.

### Use the import-pending summary on Activity Imports

Pros:

- Reuses the existing apply-preview/readiness model.
- Shows blocked, warning, ready, and total import-pending counts.
- Deep-links each candidate to Import Review for repair and apply.
- Keeps `/activity/imports` useful as a quick queue surface.

Cons:

- The view now has two modes: import-pending summary and generic failed
  candidate list.

## Recommendation Stack

- Keep Import Review as the canonical repair and apply workspace.
- Upgrade Activity > Imports into a summarized import-readiness view for
  `import_pending` candidates.
- Deep-link blocked candidates into Import Review with candidate and status
  query state.
- Link path-related blockers to Settings > Media & storage.
- Continue using bounded messages only: no raw provider payloads, usernames
  beyond candidate attribution, API keys, or host-only paths outside configured
  mappings.

## Implementation Outcome

- `ActivityImportsView.vue` now uses
  `fetchImportPendingCandidateSummary()` for the import-pending route.
- The view shows import-pending, ready, warning, and blocked counts.
- Each import-pending row shows the candidate import status, source path,
  library target, resolution strategy, and an `Review import` link into Import
  Review.
- The failed Activity route still uses the generic candidate list behavior.
- Shared selected/download/import summary copy now uses correct singular and
  plural wording for blocked candidates.
- Browser verification proves Activity > Imports renders a blocked
  import-pending candidate and hands it off to Import Review.
- The local walkthrough now explains that provider acceptance is not the same
  as import readiness when download path mappings are missing.

## Validation

- `node --test test/client/activity-imports-view-contract.test.js`
- `node --test test/server/import-candidate-import-pending-summary-service.test.js test/server/import-candidate-selection-summary-service.test.js test/server/import-candidate-execution-summary-service.test.js`
- `node --test --test-concurrency=1 test/browser/activity-imports-import-readiness-browser-verification.test.js`
- `npm run lint:client`
- `npm run lint:server`
- `npm run lint:test`
- `npm run build:client`
- `npm run build:server`
- `npm run check:esm`
- `npm run test:client`
- `npm run test:server`

## Next High-Value Item

Add Docker-backed browser verification for the live import-readiness failure
mode:

1. Seed or replay an `import_pending` candidate with missing source files.
2. Open Activity > Imports.
3. Verify the blocked summary and candidate row are visible.
4. Follow `Review import` into Import Review.
5. Verify the apply preview explains missing source paths and points the
   operator toward path mapping repair.
