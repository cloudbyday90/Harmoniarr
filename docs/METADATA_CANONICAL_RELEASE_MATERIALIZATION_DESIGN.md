# Metadata Canonical Release Materialization Design

Status: Implemented
Date: 2026-06-27
Owner: Metadata + operator reconciliation

## Purpose

Adding or saving a monitored artist should not stop at release-group metadata.
Operator reconciliation needs concrete canonical releases so it can create
desired release work, media requests, discovery requests, and eventually
download jobs.

This document records the design for automatically materializing one canonical
release per policy-selected release group during metadata artist refresh.

## Research Sources

Official sources reviewed directly:

- MusicBrainz API documentation: https://musicbrainz.org/doc/MusicBrainz_API
- MusicBrainz XML Web Service browse/lookup documentation:
  https://musicbrainz.org/doc/MusicBrainz_API/XML_Web_Service/Version_2
- MusicBrainz rate limiting guidance:
  https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting

As of June 2026, the relevant constraints are:

- MusicBrainz `release-group` browse gives album-level grouping data.
- Concrete `release` lookup is required for media and recording-level
  information used by tracklist and request workflows.
- Public MusicBrainz API usage must be rate-limited and identify the
  application with a useful User-Agent.
- Browse responses can contain many releases, so Harmoniarr should select a
  bounded candidate instead of importing every edition.

## Problem

The local Docker walkthrough exposed this sequence:

1. The operator added Lauren Daigle as a monitored artist.
2. Initial reconciliation ran before release groups were refreshed and selected
   zero desired releases.
3. Metadata refresh stored release groups, but no concrete releases existed.
4. Follow-up reconciliation selected the album/EP release groups, but all were
   unresolved because no canonical `metadata_releases` rows existed.
5. No media requests or discovery requests were created, so Downloader correctly
   stayed idle.

The bug was not Soulseek health. The missing component was canonical release
materialization between release-group refresh and operator reconciliation.

## Options

### Option A: Manual Import Only

Operators would open each release group and import editions by hand.

Pros:

- Lowest provider load.
- Maximum operator control.

Cons:

- Breaks automation-first artist monitoring.
- Leaves new monitored artists looking idle.
- Does not solve the walkthrough/local first-run behavior.

### Option B: Import Every Release Edition

Refresh would import every MusicBrainz release under every monitored release
group.

Pros:

- Complete local metadata.
- Canonical selection has the largest candidate set.

Cons:

- Expensive and slow under MusicBrainz public rate limits.
- Imports many region/reissue/deluxe editions before the operator needs them.
- Makes a single artist refresh unpredictable for large catalogs.

### Option C: Bounded Canonical Candidate Materialization

Refresh imports one preferred release candidate for each policy-selected release
group that lacks local releases, then marks it canonical.

Pros:

- Solves the automation handoff without unbounded crawling.
- Keeps provider requests proportional to monitored policy.
- Reuses existing MusicBrainz catalog/import and canonical selection services.
- Preserves manual edition override later through existing Release Detail
  controls.

Cons:

- The first canonical candidate may not be the operator's preferred edition.
- Very large catalogs may require multiple refreshes if the configured cap is
  lower than the selected release-group count.

## Recommendation Stack

Use Option C.

Implementation stack:

- `metadata-refresh-service.js` remains the orchestration boundary.
- `metadata-release-materialization-service.js` owns materialization policy.
- `musicbrainz-catalog-service.js` browses candidate releases for a release
  group.
- `musicbrainz-import-service.js` imports the selected MusicBrainz release and
  stores the release graph.
- `canonical-release-service.js` marks the imported or existing local release
  canonical.
- Operator reconciliation is queued after materialization so desired-state
  planning can resolve concrete releases.

Security and reliability posture:

- No user-supplied URLs are introduced.
- MusicBrainz requests continue through the existing outbound URL policy,
  User-Agent, retry, timeout, and rate-limit queue.
- The materializer only acts on locally stored monitored artist metadata.
- Existing local release rows are never duplicated just to repair canonical
  state.
- MusicBrainz partial release dates remain text in canonical metadata and are
  normalized before writing to downstream SQL `DATE` projections.
- The per-refresh cap defaults to `24` groups and can be tuned with
  `METADATA_RELEASE_MATERIALIZATION_MAX_GROUPS_PER_REFRESH`.

## Implemented Behavior

Metadata artist refresh now:

1. Fetches and stores artist release groups.
2. Reads monitored operator policy rows for that artist.
3. Materializes concrete releases for monitored release-group types.
4. Runs legacy wanted reconciliation when configured.
5. Queues operator artist reconciliation.

The refresh operation summary now records:

- `materializedEligibleReleaseGroupCount`
- `materializedImportedReleaseCount`
- `materializedSkippedExistingCanonicalCount`
- `materializedSkippedExistingReleaseCount`
- `materializedSkippedNoCandidateCount`
- `operatorReconciliationQueuedCount`
- `operatorReconciliationSkippedNotReadyCount`

## Outcome

For a newly monitored artist with albums and EPs selected, refresh now creates
canonical release rows before reconciliation. Reconciliation can then create
downstream media/discovery work instead of reporting every desired release group
as unresolved.

Local Docker verification with Lauren Daigle confirmed the repaired flow:

- `releaseGroupCount`: `41`
- `materializedEligibleReleaseGroupCount`: `11`
- `materializedSkippedExistingCanonicalCount`: `11` on the verification rerun
- `operatorReconciliationQueuedCount`: `1`
- latest operator reconciliation `unresolvedReleaseCount`: `0`
- latest operator reconciliation `queuedDiscoveryCount`: `10`
- `library_discovery_requests`: `10 ready`, `1 cooldown`
- `library_wanted_releases`: `11`

The first verification attempt also found a MusicBrainz partial date (`2016`)
entering the wanted-release SQL `DATE` projection. The wanted projection now
normalizes `YYYY` to `YYYY-01-01`, `YYYY-MM` to `YYYY-MM-01`, keeps full
`YYYY-MM-DD`, and stores `NULL` for invalid date text.

## Validation

Focused validation:

- `node --test test/server/metadata-release-materialization-service.test.js test/server/metadata-refresh-service.test.js test/server/metadata-module.test.js`
- `node --test test/server/library-wanted-release-service.test.js test/server/metadata-release-materialization-service.test.js test/server/metadata-refresh-service.test.js test/server/metadata-module.test.js`
- `node --test test/server/operator-artist-monitoring-store.test.js test/server/operator-artist-reconciliation-service.test.js test/server/operator-artist-reconciliation-execution-service.test.js`
- `npm run lint:server`
- `npm run lint:test`
- `npm run build:server`
