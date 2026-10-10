# Parent-owned PostgreSQL test launcher research

October 10, 2026, America/New_York. Consultation began at **18:56:36 UTC /
14:56:36 EDT**. The verified early draft was saved at **18:57:55 UTC**, before
new launcher runtime changes. Retained evidence has a record timestamp of
19:05:38 UTC (15:05:38 EDT); later interpretation below uses those same sources.

## Exact Node 24.18.1 options

The installed-version `node:test.run()` supports an explicit file list, process
isolation (default), file concurrency (default false/one), `cwd`, child `execArgv`
and `argv`, cancellation `signal`, and `env`. The `env` option was added in
24.14.0, is incompatible with isolation none, and replaces rather than merges the
provided environment with `process.env`. Construct the complete desired child
environment explicitly. `files` and `globPatterns` cannot be combined.

`setup` accepts the TestsStream and is documented for listener setup. The exact
installed runner implementation awaits an asynchronous setup callback before
running files; that source behavior is distinct from a separate documented
resource-lifecycle API. Acquire and verify the shared test PostgreSQL resource
before invoking the runner to keep ownership explicit. Keep `forceExit` false so forced
runner completion does not substitute for owned cleanup. The API returns a
TestsStream; the official example explicitly sets `process.exitCode=1` on failure
and composes a native reporter. Preserve failure accounting and drain output.
[Exact 24.18.1 test API](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/test.md).

An alternative is an explicit per-file Node CLI child launched by `spawn` with
argument arrays, `shell:false`, a pinned executable and explicit environment.
Retain existing reporter flags and default process isolation. This offers direct
per-child lifecycle ownership at the cost of owning scheduling, failure aggregation
and cancellation. Avoid shell command construction. `exit` means the process ended;
stdio may still be open. `close` follows process termination and closed stdio.
An abort or kill request does not itself prove child/descendant/resource cleanup.
[Exact 24.18.1 subprocess API](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/child_process.md).

## Early ownership guidance and limits

Own one test PostgreSQL server in the launcher, retain separate databases/pools
for scenarios, and close child admission before cancellation/teardown. Wait for
owned children and their output, then reconcile and remove only positively owned
database identities before stopping the owned server. An external PostgreSQL
server remains externally owned. Keep current serial scheduling until a complete
equivalent profile establishes another capacity choice. These are project design
recommendations, not new Node scheduling or PostgreSQL atomicity guarantees.

Host observation: Node `v24.18.1`, npm `12.0.2`; lockfile: pg `8.23.0`,
Testcontainers and PostgreSQL module `12.1.0`. Exact Node source/header is reopened
at commit `9623d9ad85d37d2f0610ec4a82b48182cf2c6061`, not inferred from newer
latest-v24 pages. Testcontainers lifecycle documentation is reopened at the
previously resolved 12.1.0 commit. Running-server versions and executed launcher
proof remain separately attributable; this agent ran no tests, PostgreSQL or
Docker actions and changed no app/runtime/test or Git state.

No UI change is proposed. Truthful CLI evidence and cleanup outcomes are project
requirements; this backend test launcher does not establish WCAG/browser behavior.

## Sequential native runs and output lifecycle

An explicit loop of `run({files:[oneFile], isolation:'process', concurrency:1,
env:completeSnapshot, forceExit:false})` is feasible as an installed-source
inference. Public documentation says each successful call returns a new TestsStream;
the exact harness creates a fresh root and counters for each call. It does not
document a dedicated multiple-run resource protocol. Global setup is process-wide
once in the implementation; keep launcher PostgreSQL ownership outside that hook.
This researcher executed no sequential-run proof.
[Exact runner](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/lib/internal/test_runner/runner.js),
[exact harness](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/lib/internal/test_runner/harness.js).

The summary DTO is `counts` with `cancelled`, `failed`, `passed`, `skipped`,
`suites`, `tests`, `todo`, `topLevel`, plus `duration_ms`, `file` and `success`.
Process isolation yields each file's summary and a cumulative root summary.
Count the final root once; do not add child summaries again. The source root has
no file location even for a one-file call. Missing final summary or stream errors
must remain failed/incomplete evidence; a success flag is broader than only an
assertion-failure counter.

For normal file completion, the exact runner waits for child **exit and finished
stdout**, then closes its stderr readline interface. It does not wait for the
ChildProcess **close** event or separately finish stderr. Non-watch transport is
internal `child-v8` serialization over stdout pipes, rather than an exposed public
IPC handle. Do not label TestsStream completion as literal worker-close/all-stdio
proof. On cancellation, its exit/stdout waits use the aborted test signal and can
reject before child termination. A cancelled stream ending therefore cannot
certify that the file worker exited. Public `run()` supplies no child handle.
Descendant processes and arbitrary external I/O remain outside that certificate.
This source finding must shape cancellation ownership rather than be hidden by
a successful cleanup label.

Readable end requires consuming its data. Reporter/output pipelines are additional
lifetime owners: use fresh reporter instances and object-mode PassThrough branches
for native spec and bounded early diagnostics, establish consumers before execution,
and await branch completion before reconciliation/next-file admission. Keep
process-wide stdout/stderr open instead of ending or awaiting their final shutdown
after each file. `Readable.compose` is stable in 24.18.1; static `stream.compose`
remains marked experimental. Pipeline/finished provide completion and error
handling, but destroying a stream is not a database or process cleanup proof.
The exact fanout remains a project integration choice requiring native evidence.
[Exact stream API](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/stream.md).

EventEmitter calls listeners synchronously and ignores returned values. An async
summary listener cannot hold advancement to the next file. The loop must explicitly
await reporting and reconciliation. Install all completion/error observations
before starting work so closely emitted events are not missed. The installed
runner also refuses recursive process-isolated `run()` when its parent has
`NODE_TEST_CONTEXT`; native nested-launcher controls must start an independent
owned launcher context rather than accidentally inherit test-worker mode.
[Exact events API](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/events.md).

## Shared PostgreSQL and control authority

Fresh PostgreSQL 18 sources retain the earlier template rules: creation/drop are
maintenance operations outside transaction blocks; creation privilege and database
ownership are required. Keep each scenario's database independent, positively
record successful creation and current database identity/role, and refuse observed
identity replacement before destructive cleanup. The OID is a cluster-local object
identity, not a permanent global capability. These project guards do not provide
atomic defense against unrelated privileged administrative SQL.
[CREATE](https://www.postgresql.org/docs/18/sql-createdatabase.html),
[DROP](https://www.postgresql.org/docs/18/sql-dropdatabase.html),
[database identity/owner catalog](https://www.postgresql.org/docs/18/catalog-pg-database.html).

`pg_stat_activity` supplies database OID, session user OID and process/session
observations. Scope reconciliation to recorded owned database identities and
authorized role, excluding the maintenance connection and unrelated sibling
databases. Permission-limited views and failures cannot become absence evidence.
`pg_terminate_backend(pid)` with timeout zero reports successful signal delivery,
not established termination. A positive timeout waits and can report failure;
retain an available zero-session check before treating a drain as complete.
[PostgreSQL activity](https://www.postgresql.org/docs/18/monitoring-stats.html),
[administration functions](https://www.postgresql.org/docs/18/functions-admin.html).

Keep one checked-out pg client throughout a transaction and release it even on
failure; pool shutdown awaits checked-out clients. Separate child scenario pools
from the maintenance owner. Do not issue overlapping statements on a single client.
[Official transactions](https://node-postgres.com/features/transactions),
[official pool ownership](https://node-postgres.com/features/pooling).

Testcontainers 12.1.0 distinguishes explicit stop from automatic exit cleanup.
An explicit stop timeout can wait for shutdown; Ryuk can be disabled/configured,
and reuse does not replace ownership. Keep the launcher's explicit stop after
owned child/database reconciliation; automatic cleanup is supplementary evidence,
not an observed guarantee that every resource disappeared. Exact release-source
documentation was freshly reopened:
[containers](https://github.com/testcontainers/testcontainers-node/blob/cdd8c898420c59747aa9390d97284e038e44e0fb/docs/features/containers.md),
[configuration](https://github.com/testcontainers/testcontainers-node/blob/cdd8c898420c59747aa9390d97284e038e44e0fb/docs/configuration.md).

If a loopback control endpoint is used, authorize every resource command with a
private current run/file capability and server-owned resource registry. Loopback
address, PID or a caller-supplied database name alone is not authority. Bound command
shapes/bodies, stop admission before teardown, and keep tokens out of URLs and
diagnostics. These are project applications of informative
[OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
and [logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
guidance, not a claim that the endpoint is a sandbox against trusted test code or
other processes with equivalent OS privileges. Native test output remains separate
from bounded diagnostic sanitization.

## Acceptance evidence and limits

First adoption should stay limited to Wanted and scan-catalogue, with raw Docker
and manually created sibling-database cases outside the negotiated cohort. Prove
two native sequential files with isolated environments and exact summary counts;
failure/reporting drains; refusal of stale/malformed control commands; child loss
and cancellation without a false exit/cleanup certificate; independent clone state;
and survival of unowned sibling databases. Retain original deadlines/assertions.
Close admission and finish owned parent requests before reconciling resources.
If true child-close ownership is required, public run-stream completion alone is
insufficient; an explicitly owned subprocess boundary requires separate design
and descendant limits. No speedup, CI capacity or cancellation cleanup was measured
by this researcher.

All Node entries above are exact 24.18.1 API documentation or implementation;
implementation observations and project inferences are identified separately.
PostgreSQL entries are vendor contracts/documentation, not SQL-standard promises.
Testcontainers entries are exact 12.1.0 framework documentation; pg and OWASP are
fresh current guidance. Prior PostgreSQL 18.3 execution observation is inherited
from the [template ledger](POSTGRES_TEST_TEMPLATES_RESEARCH_2026_10.md), not newly
queried here. No frontend/WCAG claim, provider upgrade or external exactly-once
guarantee follows from this test-only architecture.

## Retained evidence

Fresh search/navigation/source responses and version observation:
`.tmp/postgres-test-launcher-2026-10/official-research.json`.
SHA256: `235477e0308405ac3696287ecfcd42faeace491e4330733c47828464b91b1a06`.
The record timestamp is **19:05:38 UTC**, with host observation
`2026-10-10T15:05:39.2719780-04:00`. Exact immutable Node/Testcontainers paths
were reused from earlier retained repository/tree discovery and freshly reopened;
no exhaustive new repository tree was fetched. The
[PR outcome](OPEN_PR_APPLICABILITY_TEST_LAUNCHER_2026_10_OUTCOME.md) owns eligibility.

## Chosen explicit subprocess boundary

After the native-run cancellation finding, root selected an explicitly spawned
per-file native CLI runner to observe the actual owned runner's `close` event.
Keep argument arrays, `shell:false`, explicit environment, hidden Windows console
and existing native reporter flags. Quiescence is bounded to that runner's close,
drained owned output and liveness checks for known authenticated file-worker
registrations. It does not certify every unregistered grandchild or escaped process.
Reported worker PIDs are liveness observations only; they do not authorize signaling.

Fresh MCP search/opening on October 10 verified
[Microsoft taskkill](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/taskkill):
`/PID` selects a process ID, `/T` includes children started by it, and `/F` forces
termination. This is official Windows command documentation, not a web standard;
the page lists Windows 11/10 and supported Server editions. The project invocation
must use only the actual owned spawn PID, numeric arguments and local scope, rather
than image names, wildcards, remote targets or request-provided PID selections.
Command success alone is not the final quiescence observation.

[Exact Node 24.18.1 process API](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/process.md)
documents signal-zero existence probing and warns that signals do not necessarily
terminate their target; Windows rejects process-group targeting. Its
[subprocess API](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/child_process.md)
documents a new process group/session for non-Windows detached children. Preserve
the owned process handle/lifetime and avoid unref-based abandonment. A liveness
probe does not establish historical PID identity; permission/unavailable errors
must not be converted into absence.

For the non-Windows negative-PID group signaling choice, MCP search returned the
primary [Linux man-pages kill interface](https://man7.org/linux/man-pages/man2/kill.2.html):
values below -1 target the corresponding process group, and group-signal success
does not establish termination of all members. Both direct page opens timed out;
Open Group direct pages were blocked with HTTP 403. Thus this ledger records the
retrieved Linux primary search text and Node group contract, while explicitly
withholding a freshly opened current POSIX normative claim or any platform execution
proof. Root's process-group policy is an implementation choice requiring its own
native controls. No broader process enumeration/deletion mechanism is inferred.

Raw discovery/open results, exact Node process source, host OS observation and
lookup failures: `.tmp/postgres-test-launcher-2026-10/process-tree-research.json`.
Record timestamp: **19:11:01 UTC**, with subsequent alternate lookup at 19:11:13 UTC.
SHA256: `f3058b8a13bc2b02c2d42fe1708395a226d2a1db1bc3c79748d71fc7971f1c1a`.
No taskkill, signals, spawned tests, Docker or PostgreSQL actions were executed by
this researcher. OS/kernel versions and permissions beyond the recorded host
observation remain unverified; no claim of perfect descendant or PID-reuse fencing.
