# Shared PostgreSQL cohort adoption research

October 10, 2026, America/New_York. Parent-supplied baseline: `e1ce82a`.
Consultation began at **19:57:12 UTC / 15:57:12 EDT**. The verified draft was saved
at **19:57:53 UTC**, before new cohort-adoption runtime changes. Final retained
evidence has a record timestamp of 20:01:42 UTC; PR observations remain separate.

## Early recommendation and tradeoffs

Extend only a named, audited cohort whose scenario resources and detached workers
are explicitly owned. Keep native per-file process isolation, serial execution,
independent scenario databases/pools, existing assertions and deadlines. Reuse the
parent registration protocol; do not substitute one shared mutable database or an
outer transaction for committed cross-client race controls. This is a project
recommendation requiring executed evidence, not a measured speedup claim.

| Option | Benefit | Cost or limit | Recommendation |
| --- | --- | --- | --- |
| Add every PostgreSQL file immediately | Broad startup amortization | Hidden/manual database owners and detached work can evade registration/drain | Defer |
| Adopt selected files after worker/gate ownership controls | Shares startup while preserving real SQL invariants | Requires explicit completion, cancellation and cleanup proof per fixture | Prefer |
| More workers or longer deadlines | Small configuration change | Earlier profile failed; neither proves lifecycle correctness | Keep current serial/deadline contract |

Node 24.18.1 explicitly permits async activity to outlive a completed test and does
not defer reported results for it. Test timeouts can fail a test but are unreliable
as universal cancellation because event-loop blocking can prevent the deadline
callback. `t.signal` can cancel supported subtasks; it is not a certificate that
worker callbacks, SQL, filesystem or provider work stopped.
[Exact Node test API](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/test.md).

Register detached completion before startup or the first await. Race readiness
against operation settlement, release/abort controlled gates on failure, and await
actual registered work before its database/workspace teardown. Cancellation should
request cooperative stop and preserve the original Error or explicit null reason;
cleanup failures remain separately attributable. Observing a terminal parent row
or one domain callback alone is not a complete worker lifetime observation.
[Exact AbortSignal API](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/globals.md).

Preserve one pg client throughout a transaction and release it in `finally`.
Separate real concurrency actors need separate clients; parallel promises on one
checked-out client do not establish concurrent SQL. Pool shutdown waits for checked-out
clients. [Official transaction guidance](https://node-postgres.com/features/transactions),
[pool ownership](https://node-postgres.com/features/pooling).

Database cleanup must retain positive creation and current object/role identity,
not infer permission from a generated name, a timeout or an uncertain response.
Keep each scenario independently created and reconcile only acknowledged parent
records. [PostgreSQL database identity](https://www.postgresql.org/docs/18/catalog-pg-database.html),
[creation contract](https://www.postgresql.org/docs/18/sql-createdatabase.html).

## Version and evidence limits

Read-only host observation: Node `v24.18.1`, npm `12.0.2`; lockfile: pg `8.23.0`,
Testcontainers and PostgreSQL module `12.1.0`. Exact immutable Node paths were
reopened using previously discovered repository/tree URLs. PostgreSQL sources are
version 18 vendor documentation; pg/OWASP pages are current informative guidance.
Documentation and image settings are not a newly queried deployed-server version.

No tests, PostgreSQL/Docker, app/runtime/test or Git actions by this researcher.
W3C status/focus requirements do not establish frontend conformance for this
test-only change. Bounded logs should exclude tokens/credentials and arbitrary
payloads; native test output remains a separate channel.
[OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

## Precise lifetime distinctions

Freshly opened exact Node implementation corroborates the public API without
providing a universal stop guarantee. `Test.run` races the body against its
timeout/stop promise. The timeout path cancels the test signal before after hooks,
but the original raced promise may still be pending. Normal non-root completion
also aborts the controller in `finally` after hooks. Consequently an aborted
signal alone establishes neither a failed test outcome nor settled owned work.
Record outcome and actual operation settlement separately.
[Exact 24.18.1 test implementation](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/lib/internal/test_runner/test.js).

Keep readiness gates and worker lifetime promises distinct. A gate reached during
preparation does not mean a worker finished; a worker finishing before readiness
must reject the now-unreachable wait. Register the combined startup/completion
promise before constructing or launching work, so registration refusal prevents
launch and startup failure still settles registered completion. A controlled gate
should observe cancellation immediately and remove its listener when settled.
Both release failure and later tracked rejection must request cooperative stop,
then drain all already-owned work without replacing the primary reason.
These are project recommendations, not behavior automatically provided by
`Promise.race`, a timeout or a detached production worker.

An after hook is a cleanup owner, not proof that every async operation from the
body stopped. Preserve a returned lifecycle promise and actual release settlement
before database/workspace teardown; keep failure controls bounded so a deliberately
broken old helper cannot hang the test process. Do not weaken the original SQL
race/rollback assertions or fabricate worker success to free a fixture.

At the file boundary, retain the existing explicitly owned CLI close and known
worker-liveness checks. Process close follows its stdio closure; signal requests
and test result messages alone do not establish that boundary. Output abandonment
and process quiescence remain different facts. Unregistered descendants and
arbitrary external I/O are excluded from the claim.
[Exact subprocess API](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/child_process.md),
[preceding launcher ledger](POSTGRES_TEST_LAUNCHER_RESEARCH_2026_10.md).

## Fresh primary-source classification

| Source | Classification/version | Bounded use |
| --- | --- | --- |
| Node test API/implementation, globals and subprocess links above | Exact immutable 24.18.1 API documentation and separately identified implementation | Cooperative signals, async activity, timeout race and observed process lifetime |
| [PostgreSQL 18 CREATE](https://www.postgresql.org/docs/18/sql-createdatabase.html), [DROP](https://www.postgresql.org/docs/18/sql-dropdatabase.html), [database catalog](https://www.postgresql.org/docs/18/catalog-pg-database.html) | Vendor contracts/documentation; creation/drop are PostgreSQL extensions | Independent scenario databases, current OID/role and separate maintenance cleanup |
| pg transaction/pool links above | Fresh official library guidance; installed 8.23.0 separately observed | One transaction client with serialized statements, explicit release and pool shutdown |
| OWASP logging link above | Informative security-practice guidance | Bounded classification/correlation, no secrets/connection strings/arbitrary payloads, observation failures separate from work |
| [W3C status-message explanation](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block) | Informative WCAG 2.2 explanation | Applicability check only: no rendered UI/status/focus change or frontend conformance evidence here |

URLs were searched/opened through MCP or reopened from previously discovered
immutable URLs. PostgreSQL current navigation resolved the versioned 18 CREATE
page; source consultation is not publication. No deployed server was queried.
Prior server/process execution is inherited from its owning outcomes, not rerun.
Logging guidance supports a bounded evidence channel; it does not sanitize native
test stdout/stderr globally or prescribe a particular fixture DTO.

## Evidence required for the selected cohort

Before admission, prove meaningful operation-ending-before-readiness, startup and
release rejection, explicit Error/null cancellation, held-work drain ordering and
no late database/workspace teardown. Run the unchanged real PostgreSQL cases with
separate actors for locks, commits and rollback; preserve nullable/source/scope and
identity assertions. Verify matching registration/release and no unknown or dirty
owned records after file completion. Keep manually created foreign databases and
external servers outside a profile whose registration completeness was not proved.

Compare phase timings and complete populations only after equivalent assertions
pass. Broader cohort capacity and CI savings remain unmeasured. Source-only fixture
inspection or injected controls cannot replace actual PostgreSQL ownership proof;
actual SQL proof does not establish filesystem byte identity or provider behavior.
This researcher performed none of those executions.

## Retained evidence

Fresh source/navigation responses and host versions:
`.tmp/shared-postgres-cohort-adoption-2026-10/official-research.json`.
SHA256: `ccd9ed144b64aa4150b01e428773311da1593ceb327b9ca446e4d928640fce95`.
Evidence record timestamp: **20:01:42 UTC**, with host observation
`2026-10-10T16:01:42.8915229-04:00`.
The separate [PR outcome](OPEN_PR_APPLICABILITY_COHORT_ADOPTION_2026_10_OUTCOME.md)
records current applicability. Only assigned docs/ignored evidence were written;
no app/runtime/test, PostgreSQL/Docker, Git or external mutations.

## Transaction-client discard clarification

During bounded helper review, fresh official navigation from the pooling page to
the [pg Pool API](https://node-postgres.com/apis/pool) was opened at **20:07:00 UTC**,
October 10. The documented `client.release(destroy?: boolean)` returns void;
truthy `destroy` requests disconnection/removal rather than returning the client
to the idle pool. The separately inspected installed `pg-pool 3.14.0`
(`gitHead 544b1ce8152bc280e398dc1e8a66920abe6a640e`) routes that flag to its
removal path. This is library contract/source evidence, not PostgreSQL execution.

A failed BEGIN or ROLLBACK leaves transaction health unverified. Root changed the
test helper to request discard on those failures and retain ordinary release after
acknowledged rollback, preserving the original Error/null reason. Root owns the
three executed focused controls and their design/outcome attribution. This reviewer
only inspected the source. Discard requests are not synchronous server-side
connection-close or lock-release certificates; retain actual drain/cleanup checks.

Fresh navigation/API and installed-source observation:
`.tmp/shared-postgres-cohort-adoption-2026-10/pg-pool-discard-research.json`.
Record timestamp: **20:08:47 UTC**.
SHA256: `31069124ee1d5b5295f58afd6d89ea3c2252f2b2c8ee1500c22d5405963c00f5`.

## Held-transaction monitoring snapshot clarification

Fresh consultation at **20:23:49 UTC / 16:23:49 EDT**, October 10, reopened the
previously discovered [PostgreSQL 18 monitoring documentation](https://www.postgresql.org/docs/18/monitoring-stats.html)
and navigated its Statistics Functions section. Sections 27.2.2 and 27.2.26 describe
transaction-local statistics caching: current-session activity information is
collected on first access and reused in that transaction. `pg_stat_clear_snapshot()`
discards this cache so later statistics access can refresh it; it does not reset
counters. The [READ COMMITTED statement snapshot](https://www.postgresql.org/docs/18/transaction-iso.html)
is a separate MVCC contract, not a monitoring-cache refresh mechanism. The fresh
documentation index labels itself 18.6; no deployed server version was queried.

Project inference: polling from an idle held transaction preserves resource
ownership but needs a separately awaited clear-snapshot statement before each
activity read. Keep cancellation/operation checks, serialized client queries,
observer drain before rollback and the existing polling bound. Do not assume an
expression in the same SELECT establishes clear-before-read evaluation order.

Root reported the different-root admission case failing to observe a required
block after switching from autocommit polling. The documented cache is a supported
explanation pending the owning exact-case reproduction and correction; this
researcher ran no tests or PostgreSQL. It does not establish the cause of earlier
unclassified timeouts or change application transaction isolation.

Fresh raw navigation/source evidence:
`.tmp/shared-postgres-cohort-adoption-2026-10/monitoring-stats-snapshot-research.json`.
Recorded at **20:24:35 UTC**, observed host time
`2026-10-10T16:24:21.0664798-04:00`.
SHA256: `43af6a788810b49c8cc0a46b8364ca8698e8c4e8e54239cf22866d18a52d8e61`.
