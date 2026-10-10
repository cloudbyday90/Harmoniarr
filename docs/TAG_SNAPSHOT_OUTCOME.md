# Acquisition-owned tag snapshot outcome

Implemented and validated on main, October 9 local / October 10 UTC, 2026.
Separate [design](TAG_SNAPSHOT_DESIGN.md)
and [official research](TAG_SNAPSHOT_RESEARCH_2026_10.md) describe alternatives,
trade-offs, source dates and bounded guarantees.

## Implementation

The scan worker passes its original run/acquisition, requested/canonical roots
and verified catalogue root UUID. Extraction captures every observed source and
clones presentation fields before its first parser await. The guarded owner
copies payload JSON, rejects source/client overrides, and uses one transaction
with maintenance→run/key/lease→root→file coordination. Common run/lease locking
reuses the catalogue authority store rather than creating another lease contract.

Snapshot INSERT and conditional current-file UPDATE share the client, each with
an awaited current-authority/source/time check and exactly one returned identity.
The UPDATE repeats original root/path/size/nullable mtime and observed/not-deleted
eligibility. Final checks precede commit; refusal rolls back both writes. Source
stamps remain distinct from CAS predicates and current failure retains prior
successful stamps. Existing standalone internal writer transactions remain.

Parser/normalization failures have their own catch. Persistence occurs outside it,
so no database or source refusal becomes a second failed snapshot. Current genuine
parser failure still records once. Artwork starts only after accepted persistence;
typed refusals also escape its best-effort catch. No private acquisition appears
in catalogue, tag result or extraction file DTOs.

## Evidence and PR applicability

Focused owner/policy/snapshot writer tests pass 49, zero failures/skips, including
immutable original Date/source/token, payload copy, current success/failure,
source/run/lease drift, current NULL mtime, positive filename controls, exact
same-client composition, zero-row CAS and simulated full rollback. Initial 48
also passed before the extra CAS composition control. Root/test scoped lint and
security validation pass; npm audit reports zero vulnerabilities.

Extraction/worker/module/cohort focused tests pass 90, zero failures/skips.
The first smaller group passed 12/13: a fixture still expected source stamps in
payload instead of the captured source frame. The fixture now asserts both
captured measurements while preserving metadata normalization assertions; its
isolated control and full focused rerun pass. Original output is retained.

The first native-parser/PostgreSQL run passed 7/8. Arbitrary malformed text with
a .wav extension was tolerated by the actual RIFF parser as empty extracted
metadata. A truncated RIFF fixture now explicitly asserts native parseFile
rejection before testing the current failure write; the isolated control passes.
No parser strictness/version or production behavior was changed for the fixture.
Original red/green logs remain in .tmp/tag-snapshot-2026-10/. The final combined
PostgreSQL command passes 26, zero failures/skips: eight new tag cases, eight
catalogue cases, one post-import scan and nine organize cases. It proves native
tagged-WAV parsing, stale-result refusal, eight source-state drifts, cancellation/
maintenance, real root/file waits and expiry, snapshot/update faults, source
CAS zero rows, final rollback, current parser failure, consistent locking and
earlier per-file commit preservation. Complete validation passes 9,509 tests
(4,309 server, 4,377 client, 513 script and 310 PostgreSQL integration), zero
failures/skips, all required policy/lint checks and both builds. Focused groups
overlap the full run. The schema snapshot remains current at 105 migrations;
no schema change was introduced. Full evidence is in full-validate-first.log;
the final gate completed October 10 at 03:05:39 UTC. The measured-media fixture
remains harmoniarr-quality-fallback:local,
sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2,
with ffprobe 8.0.1. Native parser evidence is separate from media-quality proof.
Independent bounded source review found no material mismatch in the inspected
capture, authority, transaction, fallback and production-wiring paths.

Fresh GitHub MCP collection/head/base/scope checks found no eligible unreplayed
patch. The three open patches match their existing local replays. Separate
[PR design](OPEN_PR_APPLICABILITY_TAG_SNAPSHOT_2026_10_DESIGN.md) and
[outcome](OPEN_PR_APPLICABILITY_TAG_SNAPSHOT_2026_10_OUTCOME.md) retain discovered
URLs, timestamps and hashes; no draw or merge applies. Work stays on main without
a branch, release, tag or deployment.

The practical standards skill references map this write owner, capture timing,
parser-only fallback, stamps versus CAS, one-client rollback and later-effect
limits. Source/installed structural checks and final four-file SHA-256 identity
pass after line-ending preservation and synchronization.
No new blind behavioral skill trial, browser speech or conformance is claimed.

## Limits and next recommendation

The source CAS compares catalogue observations, not physical content hashes or
an atomic filesystem snapshot. Same-size/same-mtime physical changes may remain
invisible. Commit acknowledgement can cross a later expiry instant, and later
refusal does not undo earlier successful per-file commits. Artwork ingestion,
sidecar capture, matching and reconciliation remain separate owners.

Next priority: guard file-match persistence after awaited metadata lookup.
The [matcher](../src/server/library/library-file-matcher-service.js) accepts files,
awaits lookup rows, then derives results from supplied tagPayload and writes
[match batches](../src/server/library/library-file-match-store.js) by file ID
without the original acquisition, source or current-tag comparison. Those matches
feed release availability and request fulfillment, giving this boundary greater
operational impact than the artwork follow-up. This is a source finding, not an
executed matching race.

Prefer original acquisition and file/tag source capture before lookup, followed
by a guarded batch transaction with checked returned scope and current source/tag
comparisons. The benefit is preventing stale associations from changing coverage;
the cost is threading context through matching and preserving dedupe, confidence
and release-hint behavior. Acceptance: hold A's lookup, let B change file/
tags/matches, then resume A: no stale matched, unmatched or ambiguous writes and
no false downstream availability; current canonical matching still succeeds.

Further follow-up: guard embedded artwork's final source clear/assignment after awaited image
ingestion. Source inspection of
[embedded artwork](../src/server/library/library-embedded-artwork-service.js)
found that it accepts only file ID/metadata, awaits ingestArtworkBuffer, then
reconciles or assigns preferred artwork without the original acquisition/source
frame; the no-picture path can also clear the embedded source. This is a source
finding, not an executed artwork race.

Prefer carrying the original source/acquisition into the owning assignment or
clear transaction, with a fresh guard after ingestion. The benefit is preventing
older covers from replacing current file artwork; the cost is threading context
through ingestion/assignment while preserving preference and best-effort behavior.
Acceptance: hold A's ingestion, let B change source and artwork, then resume A:
no stale assignment or clear; current image and no-picture reconciliation succeed.
Already-created assets remain an explicit separate filesystem/cache outcome.
