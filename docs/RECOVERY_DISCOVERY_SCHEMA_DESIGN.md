# Recovery discovery schema design

Date: 2026-10-15. Scope: nine existing cases and fourteen isolated scenario
databases in music-queue-recovery-discovery.test.js. Remain on main without
a release, tag, branch or PR merge.

## Decision and ownership

Extract the custom recovery/request/scoped context and controlled discovery
worker into one small ESM fixture module. Reuse the existing recovery scenario
adapter for schema/scenario timing and actual fixtureSignal forwarding. Preserve
the zero rediscovery delay, moving Date.now() minus 50 ms clock, saved future
deadline control, reconciliation clocks, controlled provider and global-work
exclusions. Keep all original nine case bodies unchanged.

Add an independent HARMONIARR_INTEGRATION_RECOVERY_DISCOVERY_SCHEMA_MODE policy
in the existing recovery policy module, accepting only empty or migration_template.
Start with empty as the default while comparing explicit empty/template/template/
empty on identical source. Select a scoped default only after native ownership/
isolation and both-order evidence; keep global defaults and shared-parent
allowlist unchanged.

The existing worker helper registers and awaits actual completion through
dispatch, returned ingestion, lease release and eligible pruning. Direct
reconciliation is awaited. Reuse those owners: no new worker lifecycle, polling,
retry, deadline increase or shared mutable seed state. The extracted helper
exposes controlled ingestion/release/pruning callbacks for native gates while
retaining its original defaults and returned result.

## Evidence plan

Policy controls prove independent defaults, explicit comparators and bounded
refusal before resource allocation. Existing schema/scenario/lifecycle and
discovery completion controls remain. Native controls gate real preparation,
provider response, returned ingestion, actual lease release and post-release
pruning separately. Parent-visible checks must prove durable terminal status and
a released lease precede completion; Error/null cancellation must retain the
live database until actual pruning drains. The next clone from the same source
must contain no prior recovery/reservation/lease state and run fresh discovery.

Compare all nine cases and fourteen schema/scenario/drop counts, identical native
case/outcome signatures, zero skips, awaited server release and source fingerprints
before/after each profile. Template mode adds one source create/preparation/drop.
Keep measured candidate and later final-default source/evidence separate; do not
add overlapping phase durations or equate local savings to whole-CI performance.

The completed native controls and both-order comparisons support
migration_template as discovery's default. Explicit empty remains available;
the outcome separates measured candidate and final-source verification.

## Security and limits

Reuse sealed-source identity/lineage checks, explicit configured pools and strict
cleanup. Preserve current consent, provenance, reservation, lost-response and
rollback guards. Publish aggregate timing/counts and digests, keeping credentials,
actor/database identities and raw native logs private. A sealed source is not a
boundary against administrators. Controlled adapters do not prove live remote
completion, real catalog-ingestor/run-pruner semantics, full application drainage,
broad security or WCAG conformance.

See [official research/options](RECOVERY_DISCOVERY_SCHEMA_RESEARCH_2026_10.md)
and [outcome](RECOVERY_DISCOVERY_SCHEMA_OUTCOME.md).
