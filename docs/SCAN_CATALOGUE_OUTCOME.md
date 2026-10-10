# Acquisition-owned scan catalogue outcome

Implemented and validated on main, October 9 local / October 10 UTC, 2026. The separate
[design](SCAN_CATALOGUE_DESIGN.md) and
[official research](SCAN_CATALOGUE_RESEARCH_2026_10.md) describe the decision,
alternatives, trade-offs, source dates and bounded guarantees.

## Implementation

The worker now requires recordLibraryScanCatalogue, carrying its original
acquisition and separate requested/canonical roots after a successful walk.
Narrow ESM policy/service/store owners freeze observations, including Date values,
and use maintenance/run/lease/root-before-file coordination. The generic writer
accepts the owning client and awaited write-phase callbacks, preserving its
standalone API, 5,000-row batches, deduplication and existing tag metadata.

Authority/time checks guard root, file batches and tombstones, then recheck before
commit. Returned paths/counts/identities must be complete; genuinely current zero
observations and zero tombstones remain legitimate. Refusal rolls back all SQL
and starts no downstream enrichment. Existing pause/cancel/lease-loss handlers
remain the interruption owners. The token is never included in catalogue results.
Completion uses the verified catalogue count, preserving filesSeen as the walk
count. Two duplicate observations therefore cannot advertise two persisted rows.

## Evidence and PR applicability

Focused policy/owner/catalogue tests initially pass 53, zero failures/skips, including four
unchanged standalone controls, awaited callbacks, frozen Date/token/root frames,
simulated final-check rollback and actual owner/writer composition without another
pool borrow. Initial focused 52 also passed before the composition control was
added. Scoped root and test lint pass. Worker/module/cohort tests pass 83, including
authoritative persisted counts. The first module-inclusive command passed 81/82:
an injected fake catalogue with a fake worker also needed an explicit fake guarded
owner. The fixture was corrected without weakening the required production
dependency; the isolated control and original broader command passed afterward.

Late capture review found two valid-name regressions: a broad double-dot prefix
test rejected contained names, and unconditional backslash replacement changed
literal POSIX filename characters. Two added controls reproduced 53/55 passing
with two failures. Parent-component containment and platform-separator formatting
corrected the policy; the same complete focused command now passes 55/55, zero
failures/skips, while true parent traversal remains refused. Exact red/green logs
are catalogue-path-regression-red.log and catalogue-path-regression-final.log;
scoped lint passes. This changes capture validation, not catalogue SQL or locks.
Complete validation must be repeated for the final source.
The initial complete command passes 9,448 tests (4,256 server, 4,377 client,
513 script and 302 PostgreSQL integration), zero failures/skips, all policy/lint
checks and both builds. Its server tests predate the two capture regression
controls/correction; it does not certify the final source. The complete command
will be rerun with those controls included.

The first and final actual-walker/PostgreSQL suites pass eight each, zero
failures/skips; the final run includes the confirmed-count worker. Affected
post-import, operations-lock and organize integration tests pass 15. They prove
late empty/nonempty A versus committed B, genuine current emptiness,
cancellation/maintenance, real root/file lock waits with expiry, final expiry,
batch/tombstone faults, incomplete results, requested-root drift and organize
coexistence. Complete root/file/tag-stamp snapshots remain unchanged on refusal.
These counts overlap the complete suite and establish different boundaries from
injected unit rollback. Final complete validation passes 9,450 tests (4,258 server,
4,377 client, 513 script and 302 PostgreSQL integration), zero failures/skips,
all required policy/lint checks and both builds. It includes the two valid-name
regression controls and corrected capture policy. The schema snapshot remains
current at 105 migrations with no schema change. Full evidence is retained in
full-validate-first.log and full-validate-final.log. The measured-media fixture
remains harmoniarr-quality-fallback:local,
sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2,
with ffprobe 8.0.1. Final validation completed October 10 at 00:30:10 UTC.
Independent bounded source review found no material mismatch in the inspected
ownership/transaction/wiring paths; filename review and its separate red/green
controls corrected capture validation before final completion.
Security validation passes container image/topology policies and npm audit with
zero reported vulnerabilities. Evidence belongs under ignored
.tmp/scan-catalogue-2026-10/. Fresh GitHub MCP discovery,
complete pages, heads/bases and scopes found no eligible unreplayed patch. See
separate [PR design](OPEN_PR_APPLICABILITY_SCAN_CATALOGUE_2026_10_DESIGN.md) and
[outcome](OPEN_PR_APPLICABILITY_SCAN_CATALOGUE_2026_10_OUTCOME.md). No draw or merge
applies. No branch, release, tag or deployment is performed.

The practical standards skill references now map this owner, immutable
observations, current empty scans, all SQL branches, supplied-client execution,
fresh final authority and provisional-versus-committed outcomes. Source and
installed structural validation pass and all four files match by SHA-256 after
line-ending preservation and sync. This establishes structure/identity, not a
new blind behavioral trial or assistive-technology/conformance evidence.

## Limits and next recommendation

The successful walk is an observation, not a filesystem snapshot. SQL writes
can be provisional before a post-wait check rolls them back; this guarantee is
the current-owned catalogue transaction, not unexpired authority throughout every
statement or commit acknowledgement. Later tags, artwork and reconciliation are
separate owners. No media-byte, external atomicity or WCAG conformance claim is made.

Next: guard scan tag snapshot persistence after awaited metadata extraction.
Source inspection found that
[tag extraction](../src/server/library/library-tag-extraction-service.js) awaits
extractMetadata then calls
[the snapshot store](../src/server/library/library-tag-snapshot-store.js), which
inserts history and updates library_files by ID without run/acquisition or
current path/size/mtime predicates. The source measurements are stamps rather
than conditional-write guards. This is a source finding, not an executed tag race.

Prefer a captured acquisition and original file identity at that transaction,
with source comparisons and required snapshot/update rollback. The benefit is
preventing old metadata from replacing newer observations; the cost is threading
ownership into enrichment and preserving its legitimate per-file failures.
Lease-loss/cancel/pause must escape the current broad failure fallback instead
of triggering a second failed-snapshot write. Acceptance: hold old A's metadata
read, let B persist newer source/tag state, then resume A: no tag replacement,
failed snapshot or artwork; genuinely current extraction still commits.
