# Current-owned wanted-release replacement design

October 10, 2026, America/New_York. Clean main baseline:
96d1f56fd7221702aab57a2faeb6fa9524e7f320. Separate
[research](WANTED_RELEASE_RECONCILIATION_RESEARCH_2026_10.md) and
[outcome](WANTED_RELEASE_RECONCILIATION_OUTCOME.md) record sources and execution.
Work stays on main without a branch, release, tag, deployment or PR merge.

## Problem, alternatives and recommended stack

Wanted reconciliation awaits monitoring, metadata, selections, track overrides
and availability before a separate global replacement transaction. An old body
can publish obsolete desired state or delete newer per-user rows. The same raw
writer also restores authorized saved wanted data under active maintenance.
Scan, ordinary discovery and metadata refresh have different execution owners.

| Option | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| Check only in scan worker | Small change | Other producers and later waits remain | Insufficient |
| Require a scan lease for all raw writes | Uniform interface | Breaks discovery, metadata/direct rebuild and authorized restore | Reject |
| Broad producer/source-table fences | Potential stable-input protocol | Invasive ordering, blocking and retry obligations | Defer |
| Same-client rebuild with captured caller authority and revalidation | Refuses observed stale policy/source and publishes rows/links atomically | Several component reads, shared admission, bounded freshness | Implement |

Stack: existing operation workers; optional captured genuine worker context;
narrow ESM policy, reader adapter, authority store and shared publication lock;
existing wanted calculator unchanged; extracted raw write store with verified
composite identities and required link synchronization; shared transaction runner.
No schema, dependency, UI or new operation system is needed.

## Caller contracts and restore compatibility

Ordinary API: reconcileWantedReleases({workerContext}={}). Omitted context means
the existing internal direct rebuild contract. Presence of null, undefined,
malformed or partial context refuses; it never falls back to direct mode.
Capture runId, operationType and original expectedLease before any await. Allowed
leased producers are library_scan, library_discovery_dispatch and
metadata_artist_refresh with their actual lease keys. Forward the metadata
worker's original context through metadata refresh rather than rereading a lease
from runId. Scoped recovery discovery continues to skip global reconciliation;
its stored trigger also cannot authorize the generic wanted owner.

For ordinary reconciliation, explicitly select READ COMMITTED before the first
query, check maintenance with that client, lock the participating operation run
and advisory lease key/row when context exists, then shared publication admission.
Refresh current running/cancellation/acquisition/time after waits and source reads.
Direct rebuilds still require maintenance readiness and current source validation.

Authorized backup restore stays on the raw replacement contract with its existing
maintenance authority. It participates in publication admission and atomic wanted
rows/link synchronization, without a worker lease or live-policy rebuild. Preserve
its existing empty-scope skip and accepted snapshot normalization.

## Fresh reader and source identity

Add a narrow getArtistWantedProjection({artistId,queryable}) to the existing metadata
reader, using existing repository queries and release/group presentation mappers.
It reads complete wanted inputs, avoiding alias, detection, legacy monitoring,
provider and cache paths. Bind monitoring, selection, override and availability
readers to the same client; do not silently fall back to pool-bound getArtist.

The adapter retains the existing wanted calculator. Read monitored artists,
metadata groups/releases, selections and overrides sequentially on the owning
client. One transaction client does not provide parallel SQL execution; do not
reenter it through overlapping promises or rely on its deprecated query queue.
Copy monitoring before metadata awaits and metadata/selection/override values
before availability awaits. Freeze the resulting wanted rows and decision-input
frame. Compare both input frame and derived rows before DELETE, bulk upsert,
link synchronization and final commit checks. Include policy/profile fields,
explicit selections, overrides, full metadata/catalog inputs and availability.
Exclude verified unused refresh/reconciliation timestamps; do not erase dates,
nullable fields or ownership pairs. Only exact metadata_not_found/404 from the
artist read retains its existing missing-artist behavior; unrelated errors escape.

Current disabled-account/monitoring projection semantics remain. Wanted rows are
derived saved intent, not new acquisition authorization; downstream eligibility
and consent checks remain their owners. Account deletion/cascades and changed
operator identity or policy must be detected through current source reads.

## Composite persistence and link admission

The row key is (appUserId,metadataReleaseId). Build every UNNEST array from the
same validated rows; never filter paired columns independently. Keep last-value
duplicate handling for raw callers and exact unique output for the owner.
Raw UUID ownership pairs use PostgreSQL value identity: canonicalize accepted
uppercase, braced and omitted/alternate-hyphen spellings before deduplication,
paired arrays and returned-key comparisons. Ordinary source/worker UUID validation
remains strict; this normalization preserves the raw restore input contract.
Capture dates/evidence/scalars before admission awaits. Read current target pairs, DELETE
absent pairs with RETURNING and verify the complete expected deleted set. Bulk
upsert with RETURNING verifies unique full pairs, retains existing row UUIDs and
preserves desired-state/evidence semantics. Use SQL mutation clock for timestamps.

Required syncActiveWantedReleaseLinks stays on the same client after replacement,
including valid empty cleanup. Its failure or final source/authority refusal rolls
back wanted DELETE, all upserts and link changes together. Retained links preserve
existing consent/search evidence through the existing conflict behavior.

Raw wanted and raw discovery replacements acquire the same transaction advisory
key before parent mutations because both synchronize these links. Taking a lock
only inside final synchronization is too late for reciprocal parent/link waits.
This coordinates those two publishers, not every manual, FK or source writer;
SQL deadlock rollback remains possible. Discovery's separate cached-source
rebuild is a follow-up, not implicitly fixed by adding admission.

## Evidence and limits

Focused tests preserve pure projection and service/read/store oracles, captured
contexts, paired identities, same-client reads, invalid source/error refusal,
stable row IDs, empty cleanup and required link rollback. Real PostgreSQL covers
older/newer saved policy, another user sharing a release, new monitoring/metadata
inputs, selections/overrides/availability, missing artists, actual admission waits
and expiry, each real caller type, metadata/direct operation, restore under
maintenance, parent/link publisher coexistence and complete SQL/final rollback.
Run appropriate related suites and full validation before commit.

The adapter uses several READ COMMITTED component snapshots, not one global
instant or strict latest state at commit. Revalidation proves observed stability;
commits after a component's final read can require another pass. No source-table
barrier, cached retry, physical-byte, provider exactly-once or WCAG conformance
claim is added. Earlier metadata/file/availability commits and later discovery
or acquisition effects remain separate boundaries.
