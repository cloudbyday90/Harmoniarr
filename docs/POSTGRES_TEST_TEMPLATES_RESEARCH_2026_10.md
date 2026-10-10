# PostgreSQL test templates research

October 10, 2026, America/New_York. Consultation began at **17:09:55 UTC /
13:09:55 EDT**. The verified draft was saved at **17:11:06 UTC**, before new
template runtime changes. Final bounded research evidence carries a record
timestamp of 17:13:04 UTC (13:13:04 EDT); PR observations have their separate outcome.

## Early design guidance

Build a pristine schema baseline in a test-owned database, close every baseline
client/pool, seal new connections, then clone a separate database per scenario.
Never seed scenario data or run application workers against the baseline. This
is a project recommendation, not automatic isolation supplied by a cache.
PostgreSQL supports named templates, requires no other sessions at clone start,
and prevents new template connections during the copy. Creation is outside a
transaction block. Encoding and locale must match the template; database-level
settings and permissions are not copied. Keep clone connections explicitly enabled.
[PostgreSQL 18 CREATE DATABASE](https://www.postgresql.org/docs/18/sql-createdatabase.html).

Use a maintenance database connection for create/seal/drop, separate from the
baseline preparation pool. `ALLOW_CONNECTIONS false` prevents new connections;
it is not evidence that existing sessions drained or that an administrator cannot
alter the baseline. `IS_TEMPLATE true` broadens who may clone; an owning role or
superuser can clone without that broad flag. Keep baseline ownership explicit.
[PostgreSQL 18 ALTER DATABASE](https://www.postgresql.org/docs/18/sql-alterdatabase.html).

Cache admission should describe the actual preparation mode and input identity,
not merely an arbitrary caller label. Keep dedicated migration/snapshot bootstrap
tests on their original paths. Failed or cancelled preparation must never publish
a reusable baseline. A clone remains independent after creation; a shared mutable
scenario database or one enclosing rollback transaction would invalidate existing
cross-client commit/race controls. These are project design inferences requiring
executed isolation and lifecycle evidence.

Track positive creation ownership before destructive cleanup. A failed create
with an existing name must not authorize terminating or dropping that database.
Close scenario pools and drain owned work before dropping clones, then remove
the baseline only after all its clones settle. `DROP DATABASE` must run from a
different database and outside a transaction; ordinary drop can fail while others
remain connected. `FORCE` has permission and prepared-transaction/replication
limitations, so it is not a universal cleanup guarantee.
[PostgreSQL 18 DROP DATABASE](https://www.postgresql.org/docs/18/sql-dropdatabase.html).

Transactions require one checked-out pg client throughout, released in `finally`.
Pool shutdown waits for checked-out clients. Preserve independent clients for real
concurrency tests, and avoid overlapping queries on one transaction client.
[Official pg transaction guidance](https://node-postgres.com/features/transactions),
[pool ownership/shutdown](https://node-postgres.com/features/pooling).

## Version and evidence limits

Read-only host observation: Node `v24.18.1`, npm `12.0.2`; lockfile: pg `8.23.0`,
Testcontainers and its PostgreSQL module `12.1.0`. Current official PostgreSQL
navigation identifies version 18 and supplied the versioned CREATE DATABASE URL.
These are vendor documentation/API contracts, not SQL-standard guarantees.

The local integration configuration defaults to `postgres:18-alpine`; an environment
override can change that image, and external PostgreSQL mode can use another server.
No running database version was queried by this researcher. Image intent and
documentation version do not establish a deployed server's exact version.
The parent's prior `integration-final.log` records PostgreSQL **18.3**, Linux-musl,
at lines 158 and 195. Its recorded run completed at 16:03:01.7518831 UTC with
exit code zero. That inherited execution observation identifies that test run's
server; it does not verify a future template server or an external deployment.

No tests, PostgreSQL queries, Docker actions, application/runtime/test edits or Git
mutations were performed. Existing serial scheduling and race assertions remain
outside this research's changes. Potential setup savings require phase measurements;
this draft claims no measured speedup, CI capacity or template correctness proof.
No UI changes are proposed, so W3C status/focus requirements do not establish new
frontend conformance here. Bounded safe evidence and resource ownership remain
project requirements.

## Primary sources and classifications

Fresh MCP search discovered official current CREATE/ALTER and pg guidance.
Opening those pages and following their version/navigation links resolved the
versioned PostgreSQL 18 URLs below. Current navigation identified 18 as supported
current and 19 as development at consultation; no server upgrade follows from
that documentation lookup. Consultation is not publication.

| Source | Status | Relevant bounded use |
| --- | --- | --- |
| [CREATE DATABASE](https://www.postgresql.org/docs/18/sql-createdatabase.html) | PostgreSQL 18 vendor contract; PostgreSQL extension | Named-template creation, privileges, copy strategy, encoding/locale compatibility and nontransactional creation. Keep the ordinary strategy unless measurements justify changing it. |
| [Template databases](https://www.postgresql.org/docs/18/manage-ag-templatedbs.html) | PostgreSQL 18 administration guidance | `datallowconn=false` prevents new connections and does not terminate existing sessions. A sealed baseline therefore requires independently established quiescence. |
| [ALTER DATABASE](https://www.postgresql.org/docs/18/sql-alterdatabase.html) | PostgreSQL 18 vendor contract | Owner/superuser control of allow-connections and template flags; do not broaden cloning privilege unnecessarily. |
| [DROP DATABASE](https://www.postgresql.org/docs/18/sql-dropdatabase.html) | PostgreSQL 18 vendor contract; PostgreSQL extension | Separate maintenance connection, explicit ownership and bounded force/connection limits. |
| [Database catalog](https://www.postgresql.org/docs/18/catalog-pg-database.html) | PostgreSQL 18 catalog documentation | Inspect database identity, owner, encoding, locale provider and sealing flags. Those values supplement the owner's creation receipt; a name alone is not ownership. |
| [Locale support](https://www.postgresql.org/docs/18/locale.html) | PostgreSQL 18 administration guidance | Encoding/collation environment affects behavior. Preserve the accepted baseline settings and record relevant server settings in executed proof. |
| [pg transactions](https://node-postgres.com/features/transactions), [pooling](https://node-postgres.com/features/pooling), [Pool API](https://node-postgres.com/apis/pool) | Current official library guidance; installed 8.23.0 separately verified | Explicit client release and pool shutdown; checkout lifetime and same-client transaction ownership remain separate from database lifecycle. |
| [OWASP database security](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html), [logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Security-practice guidance, not normative web standards | Keep test accounts/resources separate from application/production ownership and minimize privileges. Avoid credentials, connection strings and arbitrary payloads in evidence. |

The least-privilege guidance does not remove the test maintenance role's need for
database creation/ownership operations. Limit destructive cleanup to positively
created resources owned by that runtime; never infer ownership from a convenient
prefix or a failed creation. An acknowledgement lost during creation can leave
uncertainty; ordinary failure must not become permission to remove a preexisting
database. No provider or remote exactly-once property is claimed.

The prior [fixture observability ledger](TEST_FIXTURE_OBSERVABILITY_RESEARCH_2026_10.md)
owns verified immutable Node 24.18.1 cancellation/performance sources. This slice
inherits those sources explicitly: cancellation requests cooperation, while owned
work must actually settle before resource reuse; process-relative durations measure
phases. No new Node API/version claim or frontend behavior change is introduced.
Keep opaque correlation and approved phases in output; SQL, database names and
connection credentials need not be copied into timing records.

## Proof needed before accepting the optimization

The owner should prove that preparation executes once per accepted baseline,
clones accept connections after sealing, and scenario writes remain absent from
later clones. Verify current-schema/migration tracking and required static seeds,
alongside dedicated original migration/bootstrap coverage. Different preparation
inputs need separate baselines; unchanged caller labels alone do not prove equality.
Test failed preparation/sealing, held baseline connections, cancellation, clone
failure, and cleanup of owned clones versus a same-name foreign database.

Real cross-client race/rollback tests still need independent connections and
committed state. Successful pool closure alone does not prove that unrelated
clients or prepared transactions are absent. Keep unresolved cleanup truthful,
preserve original failure identity, and do not publish partial baselines. Template
reuse within one owned lifecycle needs an explicit admission/cleanup state; shared
global mutable caches or cross-run database reuse require a separate design.
These are project acceptance recommendations, not executed claims by this agent.

## Retained evidence

Fresh primary responses, navigation, local versions/source observations and inherited
server-log observation: `.tmp/postgres-test-templates-2026-10/official-research.json`.
SHA256: `a43d74e033180f1872e9fe59e2cb0e79b38507c4b7923ecea2430a49e819284d`.
Prior executed log: `.tmp/test-fixture-observability-2026-10/integration-final.log`,
SHA256: `e74f0d5ae62f7daf97cc7ac9ffa3549e92ca976471c18c743d2b7fd6157c36fc`.
Only its version lines/state were inspected; no claim of independently reexecuting
or reviewing all preceding cases is made.
The [PR outcome](OPEN_PR_APPLICABILITY_TEST_TEMPLATES_2026_10_OUTCOME.md) records
the fresh bounded applicability assessment.
