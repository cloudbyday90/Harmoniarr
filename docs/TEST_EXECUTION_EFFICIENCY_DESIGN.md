# Test execution efficiency design

October 10, 2026, America/New_York. Separate research and outcome documents
record official sources and measurements. This work follows the operator's
request to shorten feedback while preserving high-value security and race tests.

## Measured problem

The completed wanted-reconciliation gate used 66.55 seconds for 4,432 server
tests, 7.89 seconds for 4,377 client tests and 2.88 seconds for 513 script tests.
Its 335 PostgreSQL tests took 960.63 seconds: about 92.6% of Node test time.
The existing integration command runs 72 files with file concurrency one.
Many scenarios create a fresh database and replay the migration chain; some
also start and stop a PostgreSQL container for each test.

The repeated complete gates during this slice exposed a second problem: review
findings and driver warnings were resolved after expensive broad execution.
Move source review and targeted warning inspection before the final gate.

## Immediate implementation

Use three feedback layers:

1. Changed-domain tests during implementation, including real PostgreSQL when
   transactions, locks, queries or constraints own the property. Combine the
   directly affected database files in one command rather than separately running
   the new file and then the same file again in a broader group.
2. `npm run validate:fast` for complete static checks, server/client/script tests
   and both builds. This excludes PostgreSQL and cannot certify database behavior.
3. `npm run validate` once the implementation, review and focused checks are
   stable. Keep the complete test population and fail on regressions. Repeating
   a complete gate requires a material change, failure or unresolved concern.

File concurrency two was tested through a temporary accelerated complete gate.
It exposed recovery failures, so those prototype aliases were removed and
parallel execution was not promoted. Retain the existing
`validate`/`test:integration` defaults; a local result also cannot establish CI
capacity. Preserve Node's process isolation, separate scenario databases,
test-owned workspaces, random HTTP ports and serial scenarios within each file.
The app runtime mutates process environment and the global pool, so in-process
scenario parallelism requires a separate architecture. Retain an explicit serial
command for diagnostics and constrained hosts. No unbounded worker count is used.

## Options and recommendation stack

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Focused plus fast plus complete layers | Short feedback without losing the final gate | Developers must include relevant PostgreSQL checks | Implement |
| Two isolated test-file workers | Overlaps independent setup and scenarios | Experiment exposed recovery failures | Not promoted; classify the failures before further scheduling experiments |
| More workers immediately | Potential additional speed | Capacity and race-test timeout behavior unmeasured | Defer |
| One run-owned PostgreSQL server, fresh scenario databases | Reduces repeated container lifecycle | Requires explicit ownership and cleanup across existing harnesses | Next architecture slice |
| Prepared database template cloned per scenario | Avoids repeated schema bootstrap | Template versioning, open-connection cleanup and migration evidence need design | Follow run ownership and instrumentation |
| Shared mutable database or blanket test removal | Shorter execution | Weakens isolation and hides ownership/rollback regressions | Reject |

Recommended stack: existing Node test runner with process isolation; focused
domain tests; fast static/unit/build gate; serial complete gate; disposable
scenario databases and workspaces. Then add
setup/teardown spans and consolidate run-scoped PostgreSQL ownership before
introducing verified template clones. Retain dedicated migration/bootstrap tests.

## Evidence and limits

Record actual counts, wall time, failures, skips and resource conditions for the
serial and parallel runs. A representative subset cannot justify changing the
complete default. File isolation does not make scenarios in one app process
safe to parallelize. Faster execution must retain adverse SQL, maintenance,
authority, consent, audit, cancellation and rollback controls. Benchmark results
are local observations, not CI capacity or production performance guarantees.
