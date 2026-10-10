# Test fixture observability research

October 10, 2026, America/New_York. Initial consultation began at 14:04:26 UTC
(10:04:26 EDT). The verified draft was saved at 14:07:50 UTC before the new
fixture-observability runtime changes. Final bounded consultation and evidence
retention completed at 14:10:04 UTC (10:10:04 EDT).

## Decision guidance

Expose bounded failure categories and source locations when the runner emits
`test:fail`. Keep ordinary progress and native detailed causes in the separate
native stream and complete final summary. The project's implementation omits
test identities, arbitrary messages and payloads from its additional stream.
Node's documented custom-reporter stream supports event consumption; `t.diagnostic`
alone is unsuitable for immediate failure detail because its diagnostics are
included at the end of that test's results. Built-in reporter output is not a
stable machine schema. These are Node API facts and a project recommendation,
not a measured guarantee that operating-system output is flushed instantly.
[Exact Node 24.18.1 test-runner documentation](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/test.md).

Treat cancellation as a request to stop owned work, followed by explicit release
and draining of that work. `t.signal` can be passed to abort-capable subtasks;
aborting a test does not establish that arbitrary PostgreSQL, container or
application work has stopped. Preserve the original scenario error when cleanup
also fails, and report incomplete cleanup separately. This is a project inference
from the test signal API and the explicit resource ownership below.

Use one checked-out PostgreSQL client throughout each transaction, release it
in `finally`, and finish outstanding owned operations before ending the pool.
`pool.end()` waits for checked-out clients to return; a leaked client can stall
shutdown. Race tests that require independent transactions must retain independent
clients. [Official transaction guidance](https://node-postgres.com/features/transactions),
[pool ownership and shutdown](https://node-postgres.com/features/pooling).

Measure container/setup, schema bootstrap, fixture preparation, case execution
and cleanup separately using process-relative high-resolution durations. Preserve complete versus
cancelled/failed populations. Do not infer migration or container cost from a
whole-suite duration or promote a scheduling profile before it completes with
the same assertions. A timeout records a failed or interrupted span, not completed
cleanup. The exact performance API and container evidence below support this
instrumentation; they do not establish a performance improvement.

## Fresh primary-source ledger

URLs were discovered through MCP search/official navigation or the preceding
efficiency research's retained GitHub metadata and trees, then reopened through
MCP on October 10. Existing immutable tree navigation was reused only for the
needed paths; fresh source responses are retained here. Node's source header was
reopened and verifies 24.18.1 at commit
`9623d9ad85d37d2f0610ec4a82b48182cf2c6061`. Testcontainers documentation was
reopened at the previously resolved 12.1.0 release commit
`cdd8c898420c59747aa9390d97284e038e44e0fb`.

| Primary source | Classification/version | Relevant verified finding |
| --- | --- | --- |
| [Node test runner](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/test.md) | Exact 24.18.1 API documentation | Custom reporters consume runner events; failure details carry the cause and correlation fields. Signals allow aborting supported subtasks; after hooks have separate timeout/signal options. |
| [Node spec reporter](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/lib/internal/test_runner/reporter/spec.js) | Exact 24.18.1 implementation | Failure events retain detailed failures for the root summary or stream flush; the immediate line does not print those full details. |
| [Node TAP reporter](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/lib/internal/test_runner/reporter/tap.js) | Exact 24.18.1 implementation | Its failure-event branch emits details, including the underlying error and stack, while consuming that event. |
| [Node AbortSignal](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/globals.md) | Exact 24.18.1 API documentation | Compose signals with `AbortSignal.any`, check already-aborted signals, and use one-shot listeners. A signal notifies observers; it is not a universal I/O termination proof. |
| [Node performance API](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/perf_hooks.md) | Exact 24.18.1 API documentation | `performance.now()` supplies process-relative high-resolution milliseconds. Marks/measures need explicit clearing if collected; bound any retained entries. |
| [pg transactions](https://node-postgres.com/features/transactions) and [pooling](https://node-postgres.com/features/pooling) | Current official driver guidance; installed pg 8.23.0 separately observed | One client owns a transaction; successful checkout needs release even on error. Pool shutdown waits for checked-out clients, and a single client processes queries serially. |
| [Testcontainers lifecycle](https://github.com/testcontainers/testcontainers-node/blob/cdd8c898420c59747aa9390d97284e038e44e0fb/docs/features/containers.md) | Exact 12.1.0 documentation | Explicit stop can take a timeout to wait for shutdown; automatic exit cleanup and explicit stop are different mechanisms. Reuse does not remove the need for explicit ownership and cleanup. |
| [W3C status-message explanation](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block) and [document classification](https://www.w3.org/WAI/WCAG22/Understanding/about) | Informative WCAG 2.2 explanation, not the normative specification | Relevant to user-facing status messages only. CLI/test diagnostics do not establish frontend conformance or assistive-technology behavior. |

The spec-versus-TAP finding explains the earlier recorded deferred-stack symptom
at the reporter boundary. It does not reproduce or identify the scenario failure
that originally caused that output. A new reporter should preserve the runner's
failure exit status and avoid conflating a parent subtest-failure wrapper with a
new independent underlying failure. Event arrival, stream buffering and abrupt
process termination remain timing limits; no reporter can prove cleanup completed.

For fixture barriers, retain the active operation promise and race failure against
the wait for the barrier. In cleanup, release each owned gate, observe operation
rejection, and drain before closing its client/pool. Use a separate bounded cleanup
budget rather than an already-aborted scenario signal. These are project design
recommendations, not automatic behavior supplied by `Promise.race` or Node hooks.
Racing a promise does not cancel the losing operation. If draining fails, report
that resource as unresolved; do not label the scenario cleaned merely because a
timeout or catch returned. Keep primary and cleanup errors separately attributable.

Spans should record run/scenario/phase, outcome and duration with a bounded
diagnostic payload; preserve failure/cancellation populations and cleanup evidence.
Avoid credentials, full environment dumps and provider payloads. This is a project
privacy/measurement choice, not a Node-required output schema. Instrument existing
owners without sharing mutable scenario databases, increasing concurrency or
relaxing race deadlines/assertions.

## Local observations and limits

Read-only host observation found Node `v24.18.1` and npm `12.0.2`; the lockfile records `pg 8.23.0`
and Testcontainers/PostgreSQL module `12.1.0`. Documentation versions are separate
from any running PostgreSQL server version, which this research did not query.

Baseline `testing/postgres-temporary-database.js` closes the database pool before
terminating remaining database backends and dropping the temporary database.
Several cleanup failures are caught without a diagnostic. The integration runtime
owns and stops its container; external PostgreSQL mode does not own that server.
These are source observations, not a reproduction of leaked resources.

The earlier rejected two-worker experiment lacked a complete footer and deferred
full stacks in spec output. Its recorded outcome establishes an observability
problem, not the underlying recovery failure's cause. See the separate
[efficiency outcome](TEST_EXECUTION_EFFICIENCY_OUTCOME.md). No tests, PostgreSQL,
containers, runtime edits, Git changes or external mutations were performed for
this research. W3C evidence is relevant only if a user-facing status claim changes;
this backend fixture slice does not establish frontend accessibility conformance.

No fixture throughput, phase-cost breakdown, resource leak or fix was measured by
this agent. Earlier execution and cleanup observations are attributed to the
parent's separate efficiency outcome, not rerun here. The prior two-worker profile
remains rejected; this research supplies no parallel scheduling parity or CI
capacity evidence. Existing app-runtime scenarios use snapshot bootstrap, while
18 raw integration files replay migrations per scenario according to the earlier
source audit; do not describe every scenario as replaying the migration chain.

## Retained evidence

Fresh tool responses, inherited navigation identifiers and host/source observations:
`.tmp/test-fixture-observability-2026-10/official-research.json`.
SHA256: `93161616b4bd24e5443c67f40ecaa498784ef12f5ef1e6b0c018c849c60ca51c`.
The evidence window is 14:04:26–14:10:04 UTC, October 10; consultation timestamps
are not publication dates. The separate
[PR outcome](OPEN_PR_APPLICABILITY_TEST_FIXTURES_2026_10_OUTCOME.md) owns eligibility.

A repeat host/lockfile observation at 14:12:34 UTC (10:12:34 EDT) retained the
same Node/npm/pg/Testcontainers versions. Its raw response and corrected PowerShell
lockfile parsing are retained in
`.tmp/test-fixture-observability-2026-10/runtime-versions.json`.
SHA256: `217e839234aec4724419146143d3ddb6952bc0aae1531d1979286ac83ca7ad1e`.

## Logging guidance added during bounded peer review

Fresh MCP search and opening on October 10 verified the
[OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
This is security-practice guidance, not a normative web specification. It supports
excluding secrets and connection strings, treating event fields as untrusted,
encoding/sanitizing retained values, and testing that logging failures do not
replace the application's work. Optional fixture diagnostics apply that guidance
through allowlisted fields and bounded project-relative locations; this is a
project choice rather than an OWASP-prescribed reporter schema.

The peer source review covers the separate early reporter and phase records.
It does not claim sanitization of native TAP output, arbitrary stdout/stderr or
all application logging. Native output remains a separate evidence channel.
Cleanup success must reflect established operation outcomes; the presence of a
span is not a certificate that every in-flight task or container has stopped.
Executed reporter, unit and PostgreSQL claims remain attributed to their owning
agents and the parent outcome; this reviewer ran no tests or PostgreSQL.

Raw search/open responses and consultation time:
`.tmp/test-fixture-observability-2026-10/owasp-logging-research.json`.
SHA256: `fce52f5493af9fd65fa6554aad649466e2befbe1e3bd9958023ef1933e6a5c32`.
