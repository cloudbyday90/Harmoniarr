# Recovery shared PostgreSQL cohort design

Date: 2026-10-15. Scope: admit the existing recovery execution/discovery files to
the opt-in shared PostgreSQL cohort, extending five files to seven. Stay on main
without a release, tag, branch or PR merge.

## Admission audit

| Owner | Current evidence/decision |
| --- | --- |
| Execution: seven cases/seven scenarios | Canonical scenario adapter → shared runtime → sealed migration-only source and temporary-database owner; actual execution completion is registered/awaited through provider/Activity/lease work; reconciliation is directly awaited |
| Discovery: nine cases/fourteen scenarios | Same adapter/runtime with custom context/clock; actual discovery completion covers returned ingestion/release/pruning; direct reconciliation is awaited |
| Every source and clone | Existing parent client reserves names before CREATE, commits current OID before pool admission, asserts matching identity before drop and releases only after absence; no manually created sibling databases in either canonical file |
| File/parent lifetime | Existing process adapter awaits actual child close/output drainage; parent closes admission, checks registered worker absence and reconciles before the next file |

The selected files contain no raw server startup, sibling database CREATE, shared
mutable scenario state or media workspace owner. Prior native worker/template
controls prove held returned work and independent committed state; rerun those
controls alongside native parent refusal/reaping/cancellation/sibling controls.
Do not add their raw-server adoption-control files to the public allowlist.

## Implementation

Append only the two audited canonical files to postgres-test-cohort.js. Derive
comparison cardinality from that reviewed frozen allowlist rather than repeating
five-file literals in postgres-cohort-comparison.js. The complete comparison
still refuses partial/extra selections; public selection rejects unknown and
duplicate paths. Keep explicit requested order and per-file native processes.

Reuse existing parent registry, credentials, OID capability, worker completion,
strict cleanup, failure diagnostics and comparison machinery. No new runner,
worker lifecycle, ownership protocol or production service is needed. Preserve
all source assertions/schema modes, pool bounds, deadlines and default complete
gate scheduling. The shared command remains opt-in.

The parent is already a disposable test-only Docker container, with random
credentials and separate scenario databases. It never borrows the application
database. Sharing amortizes container startup within one invocation; cross-run
reuse remains refused. Data isolation does not reserve host CPU or memory. Keep
resource-capacity changes separate from this matched comparison and retain the
observed startup failure if a later run succeeds.

## Validation and measurement

Focused scripts cover both added files, default seven-file selection, requested
order, excluded control files and incomplete/extra comparison refusal before
fingerprinting/resource allocation. Existing held-output, source drift, missing/
duplicate/changed/skipped evidence and Error/null controls remain.

Run the actual measure:postgres-cohort CLI with verified immutable PostgreSQL/
media images and tool prerequisites. Freeze source before native controls and
all four profiles: isolated forward, shared forward, shared reverse, isolated
reverse. Require 60 cases/profile, exact per-file outcome signatures, 124 schema/
scenario calls, seven template preparations/drops, 131 database creates and all
131 shared registrations released with zero reaping. Native release/close and
source stability precede savings. Timings are descriptive local evidence, not
hosted-CI or whole-gate guarantees; nested phases are not additive wall time.

## Security and limits

Keep private loopback control credentials and SQL/database identities out of
published evidence. Refuse unknown/replacement ownership instead of prefix-based
cleanup. A process signal or terminal database status grants no drainage
authority. Existing controlled provider/ingestor/pruner callbacks prove fixture
lifetime, not live external completion or full application quiescence.

See [official research/options](RECOVERY_SHARED_COHORT_RESEARCH_2026_10.md)
and [outcome](RECOVERY_SHARED_COHORT_OUTCOME.md).
