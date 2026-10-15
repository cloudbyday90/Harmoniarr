# Complete PostgreSQL cohort comparison design

Date: 2026-10-15. Scope: the existing five-file opt-in cohort, not default CI.

## Decision

Add an explicit measurement command around runPostgresTestFile and
runSharedPostgresTests. Run isolated/forward, shared/forward, shared/reverse,
isolated/reverse sequentially, with the same files and native assertions. Each
file keeps its own Node process and each scenario its own database. Shared runs
retain the existing private parent registry and parent-only server shutdown.
Dedicated lifecycle and migration acceptance files remain outside this cohort.

The old two-file baseline-first comparison and separate successful five-file
profile do not establish the full current cohort's paired benefit. This run
counterbalances profile order and reverses file order. Two pairs are descriptive
local evidence, not statistical confidence or permission to change defaults.

## Modular implementation and evidence

- A fixed optional native reporter hashes case identities/outcomes, retains
  final Node counts and aggregates approved fixture-phase durations. It omits
  raw test names, assertion payloads, paths, credentials and database identities.
- A small evidence module validates bounds, final summaries and zero skips,
  failures, cancellations or TODOs. Compare exact per-file signatures and
  unchanged scenario/schema/release work counts across all four executions.
- A policy module builds a copied environment with fresh immutable images,
  default fixture bounds/schema choices and no inherited PostgreSQL parent or
  test-filter settings; it fingerprints current tracked/unignored code inputs.
- A comparison service owns the fixed schedule, captures after actual returned
  output/release completion, validates shared registration/release with zero
  reaping, checks source identity around each sample and stops on first failure.
- The CLI verifies both Linux image identities and media tool versions before
  database work, writes logs/partial summaries in a fresh ignored workspace and
  awaits cancellation, output and artifact completion. It does not retry.

Source hashing and tooling checks stay outside sample timing. Parent phases are
captured from their actual observer, and child phases from native reporter
events; stdout formatting is not the authority for case counts. Phase durations
are inclusive and may overlap, so do not add them as elapsed wall time. Compare
work counts separately from timing. Unchanged passing assertions verify each
case's private expected state; this adds no new cross-profile database digest.
Only instrumented phases can support cost attribution. The recovery file's direct
migration/scenario calls currently lack those two phase wrappers; zero recorded
spans there does not mean zero work. Its case signatures and database-create/drop
counts remain part of the complete comparison.

## Failure and security boundaries

Missing/clipped/duplicate evidence, partial native completion, source drift,
changed cases/work counts, skipped media tests or unreleased registrations must
refuse a comparable result. Keep completed samples as partial evidence without
a successful saving claim. Actual Error/null remains primary through reporting
and cleanup errors. Signals go through existing owned process-tree termination;
no force-exit, arbitrary shell command, extra worker or increased deadline.

Use bounded numeric reports and case hashes for public results. Native logs are
ignored local artifacts and can contain ordinary test output; ignoring files is
not an access-control guarantee. Nothing grants authority to stop another user's
server or remove unrelated files. No application UI, production SQL or security
certification is part of this infrastructure measurement.

See [official research/options](POSTGRES_COHORT_COMPARISON_RESEARCH_2026_10.md)
and [executed outcome](POSTGRES_COHORT_COMPARISON_OUTCOME.md).
