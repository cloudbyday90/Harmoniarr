# Test fixture observability and lifecycle design

October 10, 2026, America/New_York. Clean main baseline: c6cca24.
Separate [research](TEST_FIXTURE_OBSERVABILITY_RESEARCH_2026_10.md) and
[outcome](TEST_FIXTURE_OBSERVABILITY_OUTCOME.md) record sources and execution.
No branch, release, tag, deployment or PR merge is introduced.

## Problem and chosen boundary

The rejected two-worker experiment delayed useful error details and could not
separate database preparation, test work and cleanup costs. Source inspection
also finds readiness waits that do not observe operation rejection and worker
completion promises that remain pending if the release adapter fails. These
findings do not establish the causes of the previous parallel failures.

Implement small ESM testing modules rather than changing application workers:

- A bounded failure reporter emits approved failure category and project-relative
  source frames from native test events before the final summary. It does not
  copy arbitrary messages, causes, expected/actual payloads or environment values.
- An injectable monotonic phase observer measures container/database setup,
  schema preparation, scenario work and cleanup. Records contain approved phase,
  outcome, duration and opaque correlation only; no credentials, SQL, database
  names, user paths or provider bodies. Observation failures cannot replace the
  operation's result or error.
- Shared fixture lifecycle utilities race readiness against operation settlement,
  release controlled gates on failure/cancellation, drain owned work before
  teardown, and preserve the original failure when later cleanup also fails.
  Worker helpers explicitly observe release errors instead of leaving completion
  pending or throwing from detached work.

Keep default serial scheduling, existing deadlines and assertion strength.
Cancellation must not be reported as proof that arbitrary in-flight work stopped:
cooperative fixture operations must settle and drain before resources are reused.
Adopt the utilities in bounded fixture paths with meaningful failure controls.
Do not claim that all legacy helpers are migrated in this slice.

The full integration reproof exposed the same unsafe readiness/release pattern
in file-match fixtures. Its follow-up extracts a small observed scan-worker
adapter and registers controlled gates, workers and the coexistence contender
with each scenario lifecycle. Prove completion-before-readiness and rejected
release behavior with bounded old/new controls; preserve all existing assertions
and deadlines. The source-observed weakness is separate from the unclassified
trigger of that run's timeout.

## Alternatives and recommendation stack

| Option | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| More workers or longer deadlines | Small configuration change | Previous experiment failed; hides setup and lifecycle weaknesses | Reject |
| Native event diagnostics, safe spans and controlled lifecycle | Prompt failure location and measured costs without weakening tests | Additional small helpers and explicit adoption | Implement |
| Global raw error/SQL logging | Extensive context | Can expose credentials, paths and private payloads | Reject |
| Prepared database templates now | Potential setup savings | Clone gain unmeasured; resource ownership and cache validity unresolved | Defer to measured follow-up |

Stack: existing isolated Node test runner; strict early failure presentation;
opt-in safe phase evidence; controlled cancellation/release/drain; focused tests
and fast validation; one stable complete serial gate where risk requires it.
Then use actual phase measurements to design run-owned PostgreSQL and pristine
scenario database clones, retaining migration/bootstrap coverage.

## Next bounded implementation design

The measured outcome supports first proving an opt-in, run-local pristine
template inside `testing/postgres-integration-runtime.js`, adopted only by the
Wanted suite. Keep its ten case assertions, serial scenarios, fresh clone per
variant, scenario-owned seeds and real independent transaction clients.
`testing/postgres-temporary-database.js` remains the creation/drop owner;
the lifecycle and backend-drain helpers remain cleanup boundaries.

Build migration-only state once through explicitly pool-bound migration
functions, verify the full migration ledger/checksums, close the template pool,
verify no connections and prohibit new connections before publication. Refuse
unprepared or mismatched templates. Key the run-local reference by preparation
mode, migration inputs/checksums, applicable snapshot bytes, preparation version
and actual server/encoding/locale configuration. Do not persist a cross-run cache.
`prepareDatabase({getPoolFn})` currently forwards that pool only to bootstrap;
its other preparation calls must not accidentally use the app-global pool.

Acceptance must establish one schema build, clone/template mutation isolation,
failed-preparation refusal, connection/fingerprint refusal, cancellation cleanup
and sibling preservation. Keep migration/bootstrap/recovery tests untemplated.
Measure clone cost and complete unchanged behavior before promotion. Only then
design a parent-owned PostgreSQL launcher shared by file subprocesses: children
own registered databases, while only the parent may stop the server. This is
planned work, not implemented ownership or a throughput claim in this slice.

## Verification and limits

Use native child-runner controls to prove a failure is reported before a held
later case completes, with secret/path canaries absent. Use injected clocks to
verify meaningful phase/outcome accounting. Deliberate readiness failure, release
rejection, cancellation and cleanup rejection must preserve original identity and
drain ordering. Real PostgreSQL checks must retain isolated database ownership,
original application invariants and cleanup. Do not rerun a rejected full parallel
experiment or infer performance improvement from instrumentation alone.

Unbounded legacy pool cleanup and application-global fixture state remain separate
resource-owner design concerns. Safe span output does not sanitize other native
reporters or arbitrary test stdout. W3C informs truthful evidence/status reporting;
this testing-only work makes no browser or full WCAG conformance claim.
