# Test execution efficiency outcome

October 10, 2026, America/New_York. See
[design](TEST_EXECUTION_EFFICIENCY_DESIGN.md) for the measured problem,
alternatives and recommendation stack. Separate
[research](TEST_EXECUTION_EFFICIENCY_RESEARCH_2026_10.md) records official sources
and version checks. Scheduling defaults remain serial.

## Implemented feedback workflow

`npm run validate:fast` runs copyright, migration naming/ID, schema snapshot,
ESM, image/topology, lint and test hygiene checks, all server/client/script tests,
and both builds. Its exact chain passed as the first phase of the recorded
prototype command: 4,434 server, 4,377 client and 513 script tests (9,324 total),
zero failures/skips, followed by successful client/server builds. The following
integration phase could start only after that chain returned zero.

Keep changed-domain tests during development, including affected real PostgreSQL
tests when SQL owns the behavior. Use fast feedback before one stable complete
serial gate. An explicit `test:integration:serial` alias is added. The testing
skill and README describe these layers and warning inspection before broad
execution. No runtime, schema or test assertion changed for this workflow.

## Measurements and rejected scheduling experiment

| Evidence | Observed result |
| --- | --- |
| Earlier complete serial gate | 335 PostgreSQL tests in 960.63s; 92.6% of 1,037.95s summed Node test time |
| Final corrected serial gate | 9,659 tests pass, zero failures/cancellations/skips, all checks and both builds pass; 335 PostgreSQL tests in 1,123.47s (18.72min) |
| Prototype fast phase | 9,324 tests pass; static checks and both builds pass |
| Two-worker experiment | Rejected and terminated after 1,412.27s wall time (23m32s), without a complete integration footer or parity proof |

The prototype used the exact temporary command `npm.cmd run validate:parallel`,
with Node process isolation, file concurrency two and the complete integration
glob. It started at 13:32:51 UTC and stopped at 13:56:24 UTC on October 10.
The lost-response batch recovery case failed after 32.49s; the same case passed
serially in 1.59s. An automatic library-add authority case reached its unchanged
90s deadline. Further failures followed. Spec output deferred full stacks until
the global footer, which this terminated run did not reach; the first underlying
cause remains unclassified. Errors printed during forced termination must not
be treated as independent application defects.

Neither assertions nor deadlines were relaxed. The prototype parallel aliases
were removed from the final package; existing complete/CI defaults remain serial.
This experiment establishes no speedup, full parallel coverage or generic
concurrency defect. Wanted source/tests stayed frozen after passing complete
serial validation.

## Recommendation stack and next work

Ship focused domain checks, fast static/unit/build feedback, and a stable complete
serial gate. This shortens the ordinary feedback loop while retaining the complete
quality gate; fast checks alone cannot prove database behavior. Reject the current
two-worker profile because it exposed failures and did not complete sooner.

Next, expose failure details promptly, measure setup/schema/fixture/case/cleanup
spans, and make fixture barriers release and drain on failure/cancellation.
Then consolidate a run-owned test PostgreSQL server and design pristine template
clones for isolated behavioral scenarios, retaining dedicated migration/bootstrap
proof. Eighteen raw integration files replay migrations per scenario; app-runtime
tests already use snapshot bootstrap. The wanted suite creates 28 isolated
databases and calls the 105-migration path in each (source-derived setup work,
not a measured breakdown). A shared mutable database or one enclosing rollback
transaction cannot replace cross-client commits and real race/rollback controls.

Local measurements do not establish CI capacity. Container startup, migrations,
query work and media/HTTP setup need separate spans before attributing cost or
claiming a template speedup. The next product boundary remains discovery-request
source recomputation; testing lifecycle work takes priority after the operator's
efficiency request.

## Retained evidence

Ignored artifacts are under `.tmp/test-execution-efficiency-2026-10/`:
`validate-parallel.log`, `validate-parallel-wall.json`, owned process/tree and
cleanup records, and official-source/timing research. The serial gate and exact
hash are recorded in the [wanted outcome](WANTED_RELEASE_RECONCILIATION_OUTCOME.md).
The owned benchmark process tree was terminated and verified absent. Ryuk
removed the owned session's containers; none remained running or stopped. No
manual container deletion or user-container mutation occurred. Six scenario
failures were observed before termination; later operations-route/file errors
were flagged as potentially stop-induced. The metrics explicitly mark
`terminated_rejected_experiment` and incomplete population.

`validate-parallel.log` SHA256:
`1e6aafe7155cf380d10ae1ad5f12217f82b7a1c794871465e0ba5596c4ace833`.
`validate-parallel-wall.json` SHA256:
`370079677412dea1b2fd3ff129e20c103c9dc5a0e2848c3da01da63e998ee43c`.
`evidence-sha256.json` inventories ownership, termination, cleanup and partial
metrics records. No retry or full parallel pass is claimed.
