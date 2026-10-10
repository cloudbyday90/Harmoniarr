# Test fixture observability and lifecycle outcome

October 10, 2026, America/New_York. Baseline main: c6cca24. Separate
[design](TEST_FIXTURE_OBSERVABILITY_DESIGN.md) and
[research](TEST_FIXTURE_OBSERVABILITY_RESEARCH_2026_10.md) precede implementation.

## Implemented boundary

Serial integration uses native spec output plus a separate early failure stream.
The new ESM formatter/adapter emit approved categories/codes/classes and verified
project-relative locations/frames on native failure events. Arbitrary messages,
causes, test names, expected/actual values and stdout/stderr are not copied into
that bounded stream. Lexical containment precedes filesystem lookup; canonical
containment rejects source escapes. Independent native output remains unsanitized.

`HARMONIARR_INTEGRATION_PHASE_TIMINGS=1` enables safe monotonic measurements in
PostgreSQL and app fixtures. Approved phase/outcome/duration records use opaque
correlation and parent IDs; they omit database names, credentials, SQL, workspace
paths and provider bodies. Observation failures do not replace operation results.
Records are terminal phase observations; overlapping spans are not additive gate
wall time and aborted arbitrary work is not certified stopped by a signal.

Shared lifecycle utilities race readiness with settlement, release controlled
dependencies, observe worker adapter errors, and drain registered cooperative work.
Release/drain failure requests cancellation too; earlier waiting work cannot hide
a later rejection. Original body/observed cancellation errors retain priority.
Targeted handoff/recovery/wanted fixtures adopt these controls. The later
file-match follow-up uses an extracted observed scan-worker adapter, races every
controlled readiness checkpoint against completion, registers gates with the
scenario signal and tracks workers/contenders before teardown.

Temporary-database destructive cleanup requires acknowledged creation. A refused
creation never authorizes terminating or dropping an existing database. The
extracted backend drain requires an available integer count and observed zero;
unreadable counts, remaining backends at deadline, or invalid clocks fail its
span. The caller catches outside measurement to preserve the primary error and
continue owned DROP/admin cleanup. App preparation is inside teardown protection;
HTTP teardown closes owned active sockets without replacing a scenario failure.

No application worker, route, schema, dependency, concurrency or existing deadline
was changed. New first-party modules are ESM. Work remains on main without a
release, branch, tag, deployment or PR merge.

## Validation evidence

| Boundary | Result |
| --- | --- |
| Root observer/temporary DB/app/HTTP focused controls | 20 passed before drain closure |
| Verified backend drain/temporary DB controls | 8 passed after peer closure |
| Lifecycle/worker helper focused controls | 22 passed, zero skips |
| Scan startup/readiness/release/cancellation controls plus existing lifecycle group | 29 passed, zero skips; seven new scan-helper cases; scoped lint passed |
| Refreshed complete server suite | 4,484 passed, zero failures/cancellations/skips, 66.94s |
| Early reporter, including native default-isolation held child | 12 passed, zero skips; scoped lint passed |
| First combined real PostgreSQL group | 32 passed, five suites, zero failures/cancellations/skips, 143.27s |
| Affected PostgreSQL group after peer cleanup fixes | 12 passed, two suites, zero failures/cancellations/skips, 69.69s |
| Initial complete serial `npm run validate` | Failed: 4,477 server, 4,377 client and 525 script tests passed; integration 336/338 passed, two failures, zero cancellations/skips; builds not reached |
| Minimal unchanged push-subscription reproof | Both failed files passed, 2/2, zero skips, 18.07s |
| Superseded integration stage reproof | Terminated after file-match timeout and fixture follow-up; no complete footer, ten media skips, 1,133.55s wall time; no parity claim |
| Corrected complete real file-match suite | 8 passed, one suite, zero failures/cancellations/skips, 45.49s; original assertions/deadlines retained |
| Stable complete integration stage | `npm run test:integration` passed 338/338, 47 suites, zero failures/cancellations/skips, 1,047.11s (17m27s) |
| Completed validation across stages | 9,724 passed: 4,484 server, 4,377 client, 525 script, 338 integration; zero failures/cancellations/skips in these completed stages |
| Static, lint and policy checks | Initial complete command passed all before testing; copyright/ESM/test hygiene/test lint refreshed after scan-fixture changes and passed |
| Client and server builds | `npm run build` passed after the initial gate |
| Security | Passed; zero npm vulnerabilities |
| Maintained skills | Structural validation passed; four-file standards source/installed identity passed |

The original HTTP controls failed two of three cases: teardown masked the original
error and an active socket caused shutdown timeout. The same three cases pass
after correction. Real worker helper controls failed two cases before observation;
null-cancellation/late-registration and cleanup-cancellation controls also retain
actual red/green logs. Reporter tests exposed URL query handling and inherited
runner context in its owned child; both were corrected. A mocked filesystem
control reproduced an outside/UNC path probe before rejection, then passed after
lexical guarding. No real outside/UNC lookup occurred in that reproduction.

Before the final gate, source review found drain spans falsely reporting success
and release errors not cancelling signal-dependent work. Focused adverse controls
and the affected real PostgreSQL command pass after their bounded corrections.
No assertion or timeout was weakened. Final counts overlap these focused groups.

The initial complete gate recorded `read ECONNRESET` in the existing push
invalidation test's observer query at line 108, and the existing pruning store's
sanitized `Invalidated subscription pruning failed` error at pruning test line
70. Both files use the unchanged Dockerized PostgreSQL harness. The bounded
reporter emitted two location/category records before the final 338-test summary.
Both tests then passed unchanged together with serial TAP. Their original causes
remain unclassified; non-reproduction does not establish a fixture fix or justify
changing application code, assertions or deadlines. The failed full log is retained
separately from reproof logs. Reverification resumes at the failed integration
stage, retaining the already-passing static and 9,379 non-PostgreSQL checks.

That integration attempt then emitted a timeout for the nullable-tags case in
`test/integration/library-file-match.test.js:253`, followed by native warnings
about work still active during database teardown. The superseded attempt was
stopped after the fixture correction began; its incomplete population cannot
establish parity. Source inspection found a definite fixture weakness: bare readiness
waits could hide completion before the checkpoint, and the release gate reported
success even if its adapter rejected. Bounded controls reproduced both failures
against the old helper and pass against the extracted observed helper. The
file-match fixture adopts signal-controlled release/drain without changing its
existing assertions or 90s deadline. This proves the fixture weakness and
correction, not the original timeout's trigger. The early bounded record made
that timeout visible before the complete footer.

Bounded peer reread then found registration happening after startup, allowing a
late scenario continuation to launch work before registration refusal. Three
controls failed against that version and pass after pre-abort refusal,
registration before launch and settled factory/startup rejection. Exact Error
and `null` cancellation reasons survive; no worker launches after refusal.
The owning group passes 29 tests and scoped lint; bounded source reread is clear.
The whole real file-match command then passes eight cases, including all nullable
tag variants, with no asynchronous-activity, uncaught/unhandled or warning lines.
It captures 205 safe runtime records across 30 correlations and 29 verified
owned-database drains. No test processes/containers remained; user containers
were untouched and command-specific environment settings were restored.

Final `npm run test:integration` passes all 338 cases with the configured media
image, including both original push failures and all corrected file-match cases.
The nullable-tag case completes in 3.83s and the whole file-match suite in 43.98s
within that run, with no late activity warning. These are passing observations,
not attribution of the old timeout or a demonstrated general throughput gain.
The initial `npm run validate` remains failed evidence: verification completed
by retaining its unchanged client/script/static results, refreshing all server
tests, rerunning the complete failed integration stage and completing both builds.
No claim that the original command returned zero is made.

The retry also omitted `HARMONIARR_INTEGRATION_MEDIA_IMAGE`, unlike the initial
gate, and ten media scenarios skipped before termination. This omission is
recorded rather than counted as passing coverage. The stable attempt must use
the same existing `harmoniarr-quality-fallback:local` fixture image as the first
gate. Its inspected image ID is
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`.
Only the verified owned runner and child were stopped. Both were absent afterward;
Ryuk removed the owned PostgreSQL/Ryuk containers, leaving user containers intact.

Actual fixture engine: PostgreSQL 18.3 Alpine. Host Node24.18.1/npm12.0.2.
Schema remains at 105 migrations. The local media fixture was
`harmoniarr-quality-fallback:local`; this is executed evidence, not a latest-image
or deployment claim.

## Measured costs and recommendation stack

The first combined group captured 483 safe phase records across 59 correlations.
Wanted's 30 variants had schema preparation median **1,631.34ms** and summed
**49.72s**, fixture seed median **89.22ms**, and scenario median **97.12ms**.
Wait/fault cases vary; other suites do not all have explicit schema spans. The
post-closure group captured 302 records across 31 correlations, with 30 actual
backend-drain records passing. These are phase observations, not whole-gate sums
or an established throughput improvement.

Keep isolated serial execution, bounded event diagnostics, opt-in phase evidence,
cooperative release/drain, focused checks and one stable final complete gate.
Benefits are prompt actionable locations, truthful cleanup evidence and measured
setup cost. Costs are explicit fixture adoption and optional trace output; these
helpers cannot cancel arbitrary I/O or repair every legacy pool lifecycle.

Next: prove an opt-in pristine template within the existing per-file PostgreSQL
runtime for Wanted's 30 variants. Seal migration-only state, verify its ledger,
clone fresh scenario databases and retain the ten unchanged cases. Add real
clone/sibling isolation, preparation/fingerprint/connection refusal and owned
cancellation controls. Keep migration/bootstrap/recovery tests untemplated and
measure clone cost before promotion. Then design parent-owned PostgreSQL shared
across file subprocesses; child ownership cannot authorize stopping that server.
The [next bounded design](TEST_FIXTURE_OBSERVABILITY_DESIGN.md#next-bounded-implementation-design)
records the pool-forwarding trap and acceptance boundary. Unregistered work and
unbounded pool shutdown remain separate limits; this plan does not explain the
two non-reproduced push failures. Discovery-request source recomputation remains
the next product boundary.

## Evidence, skills and PR applicability

Root/reporter/research logs are ignored under
`.tmp/test-fixture-observability-2026-10/`; backend controls, real PostgreSQL
metrics and cleanup records are under `.tmp/fixture-observability-2026-10/`.
Both targeted PostgreSQL commands completed without warnings or remaining test
processes/containers; user containers were untouched. Initial complete-gate,
integration reproof and build logs are separate. Final cleanup at 16:04:11 UTC
found no integration processes or Testcontainers resources. The 30-file code/config
manifest remained identical through final verification. Commit and remote
publication verification are reported with the final Git state.

Retained final evidence: `.tmp/test-fixture-observability-2026-10/final-validation-evidence.json`.
Final integration log SHA256:
`e74f0d5ae62f7daf97cc7ac9ffa3549e92ca976471c18c743d2b7fd6157c36fc`.
Initial failed full log SHA256:
`9a85e14447715df19e65437678ad76ecba3502e0ef71a880bc193b59d56af640`.
Superseded incomplete reproof log SHA256:
`7a18ccc5bc0f569c37de534243c4edaf498c347eec7dc383885276188e694ab5`.
The evidence manifest inventories server/build/security/static/skill/code hashes
separately; overlapping targeted counts are not added to the final total.

The testing skill and standards references now map event arrival, safe phase
records, original causes, release/drain and creation-owned cleanup to concrete
owners. Entry point, metadata and invocation policy of the standards skill remain
unchanged. Structural checks are distinct from helper/database execution and
frontend/WCAG conformance.

Fresh open-PR applicability is separate:
[design](OPEN_PR_APPLICABILITY_TEST_FIXTURES_2026_10_DESIGN.md) and
[outcome](OPEN_PR_APPLICABILITY_TEST_FIXTURES_2026_10_OUTCOME.md).
