# Apply worker lifetime outcome

October 11, 2026. The controlled original worker test acquired the same run twice
while its first lease release was held; the expected single acquisition failed
with `2 !== 1`. The retained baseline is
`.tmp/apply-worker-lifetime-2026-10-11/rejected-unit.log`. This is a reproduced
worker lifetime defect, not a reproduced cause of historical first-checkout
bootstrap failures.

## Implemented result

Small ESM factories own task admission/completion, execution/cleanup precedence,
and best-effort advisory work. The apply worker's queued start acknowledgement
remains immediate; its active run remains coalesced until all returned advisory
callbacks, admitted heartbeat renewal and captured lease release settle.
Terminal close rejects new starts and drains every admitted task even after a
sibling failure. Escaped failures, including null, are observed and retained.

The acknowledgement includes a per-run completion handle. The shared media
fixture waits for it and then reads the terminal run once, replacing status
polling and its 100 ms sleeps. A real held lease finalizer reproduced the old
fixture reading status early (`1 !== 0`). This is a separate proven lifetime gap.

Lease heartbeat `stopAndDrain()` closes tick/timer admission and awaits admitted
renewal. Existing ordinary stop stays available for other owners. The actual
application's apply worker is closed by both fixture entry points after HTTP
closure and before pool/environment/workspace teardown; production startup also
closes it before the pool. The shared cleanup adapter preserves primary Error/
null errors without a throw from finally. Best-effort callback errors do not
reclassify files already applied or change the persisted domain outcome.

The [design](APPLY_WORKER_LIFETIME_DESIGN.md) gives alternatives/pros/cons and the
recommended stack; the [separate research](APPLY_WORKER_LIFETIME_RESEARCH_2026_10.md)
records current MCP-opened official contracts and source status.

## Executed development evidence

- Final focused controls: 45 passed, no failures/cancellations/skips. They cover
  the original duplicate-release defect, late admission, pre-launch registration,
  queued/reentrant scheduler failure, sibling drainage, cooperative cancellation,
  Error/null identity, actual held renewal, advisory callbacks after persisted
  completion and production shutdown before pool close.
- Native owning cases: 7 passed, no failures/cancellations/skips. Both fixture
  entry points hold an actual PostgreSQL lease finalizer across HTTP closure,
  keep the scenario database/environment/workspace available, then release and
  clean up. Null scenario errors win over failing worker cleanup. Existing
  apply-store/route and request-owned post-apply reconciliation cases also pass.
- After adding the per-run handle, the refined lifetime suite and complete
  automatic-authority file passed 13/13 together in 91.45 s without skips. A
  subsequent unchanged lifetime-only diagnostic run passed 5/5 in 50.53 s under
  the original deadlines with all checkout/phase observations enabled. These
  are separate development runs, not replacements for full native validation.
- Scoped lint passes. The earlier rejected lint found an unsafe-finally throw;
  it was replaced with a separate work/cleanup adapter. An earlier focused
  heartbeat control exposed the interval runner's `tick_in_progress` guard;
  terminal tick admission is now guarded before that runner. Rejected logs are
  retained rather than relabeled as passing evidence.
- Host Node 24.18.1, pg 8.23.0 and pg-pool 3.14.0 were read locally. The existing
  immutable media fixture is configured before the complete gate to execute
  media-worker prerequisites instead of treating skips as coverage.

Commands from PowerShell at the repository root:

```powershell
node --test test/server/worker-task-lifecycle.test.js test/server/worker-advisory-tasks.test.js test/server/app-worker-lifecycle.test.js test/server/import-candidate-apply-worker-lifetime.test.js test/server/import-candidate-apply-worker.test.js test/server/operation-run-lease-heartbeat.test.js test/server/integration-app-runtime.test.js test/server/startup-runtime.test.js
node --test --test-concurrency=1 test/integration/apply-worker-lifetime.test.js test/integration/import-apply-operations.test.js test/integration/import-apply-post-apply-scan.test.js
npm run validate:fast
$env:HARMONIARR_INTEGRATION_MEDIA_IMAGE = 'sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2'
$env:DEBUG = 'testcontainers:containers'
$env:HARMONIARR_INTEGRATION_PHASE_TIMINGS = '1'
$env:HARMONIARR_INTEGRATION_POOL_DIAGNOSTICS = 'all'
node --test --test-concurrency=1 --test-reporter=tap --test-reporter=./testing/reporters/early-failure-reporter.js --test-reporter-destination=stdout --test-reporter-destination=stderr 'test/integration/**/*.test.js'
```

The owning-case command records the initial seven-case development run; the
later per-run control adds one native case. The final diagnostic wrapper restores
all four scoped environment variables in finally. The original default
`npm run validate` attempt and the later native attempts are recorded separately
below; these command excerpts do not relabel their failures.

The first frozen full gate passed its static/unit layers but failed one automatic
authority assertion at `music-queue-automatic-library-add.test.js:243`. Its actual
cause is unconfirmed: the unchanged single case passed, then its unchanged full
owning file passed 8/8 under TAP. The rejected full gate was stopped using its
verified root PID/creation identity; its incomplete native coverage is not a pass.
The raw log, initial staged patch, source hashes and known process snapshot remain
in `validate-rejected.log`, `rejected-source.patch`, `code-freeze-rejected.json`
and the rejected process/state records. The added variant in the assertion's
diagnostic message changes neither its expected count nor its authority guard.

The final 18-file candidate passed the complete fast gate: 4,647 server, 4,384
client and 552 script tests (9,583 total), zero failures/cancellations/skips;
static/schema/ESM/image/topology/lint/test-hygiene checks and both builds passed.
The subsequent native attempt was rejected at the fifth lifetime case's first
schema checkout, before its application or apply worker existed. The observed
connection timeout took 10,014.98 ms: total/idle/waiting were 0/0/0 before,
1/0/0 when requested and 0/0/0 when settled, with max 2 and the unchanged
10,000 ms connection timeout. This was not an observed queued pool waiter.
TCP, authentication, server and event-loop causes remain unconfirmed; database
admission alone does not prove current server liveness. The exact owned process
was stopped after retaining `startup-rejected-native-tap.log` and the associated
state/stop records. The earlier fast result remains valid for unchanged source.

Host observations around that rejection showed 100% CPU and less than 2 GiB
free RAM. The user provided a quieter validation window; before the next native
attempt the host showed 41% CPU and 5.58 GiB free RAM. These are contextual
observations, not proof of the timeout's cause. No unrelated process or service
was stopped, and no case, suite or connection bounds were extended.

The quieter native attempt also remains rejected. Three provider-refusal cases
reported `ECONNRESET` (the first while reading the execution run summary), and
three Import Review cases reported first-schema connection timeouts. Its native
coverage is incomplete. The verified root process was stopped; raw TAP and stop
identity evidence remain in `quiet-rejected-native-tap.log` and associated records.
The observed PostgreSQL container had already been removed before attempted
inspection, so no server state from that failing window is asserted.

Without code or deadline changes, the complete provider-refusal file passed 9/9
with Testcontainers server logs enabled (51.05 s), and Import Review passed 3/3
with server logs plus existing phase/checkout diagnostics (8.52 s), both without
skips. Provider logs also expose transaction-state warnings during existing
migration/fixture activity; these are retained, not presented as a diagnosed
cause of the connection resets. Isolated passes do not remediate or explain
the rejected complete run. The subsequent complete native diagnostic profile
captures server logs and first-checkout phases/counters without changing
scenario membership, per-file isolation, serial scheduling or native bounds.

The per-run completion fix is independently supported by its controlled native
failure, not attributed as remediation of that authority assertion. Complete
publication validation uses the complete fast gate and every integration file
serially under TAP after this material lifetime change. The native glob, scenario
isolation and case/suite deadlines are unchanged; TAP provides immediate private
assertion detail. Builds run with the fast layer before the native layer rather
than after it. The fixture's status-polling loop is replaced by actual completion
under those existing case/suite bounds, not by a longer polling deadline.
The final complete native diagnostic gate exited zero: 369 tests passed, with
zero failures, cancellations, skips or todos. TAP elapsed time is 1,596.64 s;
the monotonic wrapper measured 1,597.82 s (26 min 37.82 s), including process
launch. It uses the unchanged serial glob and original bounds, with existing
phase/checkout observations and Testcontainers server logging enabled. This
is a complete diagnostic-profile result, not a successful default
`npm run validate` invocation or a matched performance comparison.

Together with the unchanged fast layer, final candidate coverage is 9,952
passing tests without skips. Both builds and all fast checks passed separately.
The existing `harmoniarr-quality-fallback:local` media image has the immutable
ID in the command above and observed ffprobe 8.0.1; it supplied actual media
prerequisites in the complete run. No dependency or production image input was
changed to supply those tools. The eight automatic-authority cases also passed
in this complete diagnostic run; the earlier assertion remains unexplained.
The reset/timeout failures remain unexplained too. Passing diagnostics are not
attributed as causal remediation of any rejected complete run.

Final source and index checks match all 18 frozen code files. Eleven changed
Markdown documents have 390 resolving local links; whitespace checks and
standards/testing structural validation pass, and all four installed standards
files match their source. Raw private evidence remains under
`.tmp/apply-worker-lifetime-2026-10-11/`, including `final-fast.log`,
`diagnostic-native-tap.log`, `diagnostic-native-result.json`, code hashes and
the separate rejected-run artifacts. No raw vendor logs or connection details
are committed as evidence.

## Boundaries and next work

The residual 150 ms wait stays in place. Other app workers, in-progress periodic
dispatch, queued child scans and callback work that is not returned are separate
owners. Closing this apply instance does not certify application-wide quiescence,
cancel arbitrary I/O or remediate historical bootstrap failures. No full-gate
speedup or new browser/WCAG/security certification is claimed.

Next: diagnose first-schema connection establishment and SQL socket resets with
bounded independent evidence from the owned server at failure, and reproduce the unconfirmed full-run authority
assertion with its newly recorded variant and actual owning completion boundaries
before claiming causal remediation. Then audit the operation dispatcher's in-progress tick and claimed/launched
work, then propagate completion ownership to its worker consumers starting with
library scan. Stop claim admission before drainage and preserve durable queued
commands across shutdown. Remove the residual fixture wait only after remaining
owners have controlled completion/cancellation/failure proof; then assess the
exhaustive cohort/remainder dispatcher for test efficiency.

The [fresh PR assessment](OPEN_PR_APPLICABILITY_APPLY_LIFETIME_2026_10_OUTCOME.md)
found no unreplayed applicable patch. Standards/testing references were maintained
without a new skill entrypoint, metadata or invocation policy. Main only; no new
branch, release or PR merge. The previously validated Docker deployment is not
rebuilt in this round. A separately verified existing media-tool image supplies
the isolated fixture; the live walkthrough deployment remains separate.
