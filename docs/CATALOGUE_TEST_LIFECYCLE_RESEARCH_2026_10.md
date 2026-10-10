# Catalogue test lifecycle and template research

October 10, 2026, America/New_York. Parent-supplied baseline: `ed25034`.
Consultation began at **22:05:55 UTC / 18:05:55 EDT**. The verified draft was saved
at **22:06:42 UTC**, before new catalogue fixture runtime changes. Final evidence
was recorded at **22:08:13 UTC**. Parent execution is separate.

## Early recommendation

Close catalogue fixture worker/gate/client/workspace ownership first, then assess
its explicitly selected migration-template mode. Keep the existing native serial
file loop and independent scenario databases/pools, real walk observations,
assertions, polling bounds and deadlines. Reuse the common scoped lifecycle,
worker observer, workspace and transaction-client owners; do not add another
scheduler/cache or make timeout expiration mean work finished. This is a project
recommendation, not a measured gain or a default-mode promotion.

Fresh exact Node 24.18.1 documentation says test results need not wait for
extraneous asynchronous activity; `t.signal` can abort supported subtasks.
Register combined startup/completion before launch, race readiness against actual
settlement, release controlled holds on cancellation/failure and drain owned work
before database or media teardown. Keep the original Error/null cause when
secondary release/cleanup fails.
[Exact test API](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/test.md),
[exact AbortSignal API](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/globals.md).

Keep same-client transaction statements serialized. A borrowed idle lock holder
may serve as an observer only while no owner query is active; stop new observer
reads on abort and drain its current read before rollback. Refresh its monitoring
snapshot before each activity poll. This monitoring cache is separate from ordinary
row MVCC snapshots. Defer captured lease release until held transactions settle.
[pg transaction guidance](https://node-postgres.com/features/transactions),
[PostgreSQL 18 monitoring](https://www.postgresql.org/docs/18/monitoring-stats.html).

The existing private template owner is preferable to seeded-source or shared-row
reuse after lifecycle proof. Prepare and verify a migrated source, close its pool,
seal new connections and verify identity/zero sessions before cloning. Existing
source sessions are not ended merely by sealing. Preserve clone locale/encoding;
database settings/GRANTs are not inherited. Build each clone pool from owned config,
keep its actual idempotent migration check and seed fresh workspace/rows afterward.
[CREATE DATABASE](https://www.postgresql.org/docs/current/sql-createdatabase.html),
[template contract](https://www.postgresql.org/docs/18/manage-ag-templatedbs.html).

Testcontainers' explicit stop and automatic Ryuk cleanup are different lifecycle
mechanisms. Default stop does not wait for the container to stop; supply its
explicit timeout when that observed boundary is required. Reuse is not proof of
fresh state or local resource ownership.
[Current official container documentation](https://node.testcontainers.org/features/containers/),
[exact 12.1.0 source documentation](https://github.com/testcontainers/testcontainers-node/blob/cdd8c898420c59747aa9390d97284e038e44e0fb/docs/features/containers.md).

## Initial version and evidence limits

Fresh host observation: Node `v24.18.1`, npm `12.0.2`, at
`2026-10-10T18:05:55.2202155-04:00`. Lockfile: pg `8.23.0`, pg-pool `3.14.0`,
Testcontainers/PostgreSQL module `12.1.0`. Exact immutable Node/Testcontainers
sources were freshly fetched through GitHub MCP; current documentation is
separately classified and is not deployed server evidence.

Read-only catalogue source still has release-only completion, unbound readiness
holds and manual workspace/client cleanup. Those visible ownership gaps motivate
bounded controls; they are not reproduced failures in this research. No tests,
PostgreSQL/Docker, Git, runtime/skill/README or external mutations by this
researcher. This test/CLI-only change has no frontend or assistive-technology
conformance claim. Fresh navigation identifies PostgreSQL documentation 18.6;
this does not replace inherited actual 18.3 execution evidence or establish a new
deployed-server query. Current search also returned other Node majors, which were
not used for the installed-version contract.

## Source classification and concrete application

| Verified source | Classification | Application / limit |
| --- | --- | --- |
| Exact Node test/globals links above | Immutable 24.18.1 vendor API documentation | Supported cancellation and extraneous activity; no universal stop guarantee |
| [PostgreSQL 18 CREATE](https://www.postgresql.org/docs/18/sql-createdatabase.html), template link above, [DROP](https://www.postgresql.org/docs/current/sql-dropdatabase.html) | Version 18 vendor command documentation; PostgreSQL extensions | Source connection exclusion, compatible clone profile, acknowledged creation/current identity and separate cleanup |
| pg transaction link above and [Pool API](https://node-postgres.com/apis/pool) | Official library API/guidance, installed lockfile versions separately observed | One serialized transaction client, return/discard decisions and pool closure |
| Exact/current Testcontainers links above | Immutable 12.1.0 documentation plus current guidance, distinguished | Explicit stop timeout versus automatic cleanup/reuse; no measured local container action |
| PostgreSQL monitoring link above | Version 18 vendor documentation | Transaction-local activity snapshot refresh; not row MVCC, lock release or operation completion |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Informative guidance | Opaque correlation, approved labels/outcomes, no credentials/tokens/connection strings/arbitrary payloads |
| [W3C status-message explanation](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Informative WCAG 2.2 explanation | Applicability only; unchanged UI has no new browser or assistive-technology proof |

The exact Node version header was reopened at commit
`9623d9ad85d37d2f0610ec4a82b48182cf2c6061`, confirming 24/18/1. Test API blob:
`96178f2a56515f0c87a5060843a755642ef31eca`; globals blob:
`8b96e41bed3f365d54967fc3e1e96d5ca30de6b7`; header blob:
`111a22053c288ecd4e110ac611d799cd117d53b2`. Exact Testcontainers containers
documentation blob: `743444034d442f6f1692e70eee98850e1dd15121` at the linked
12.1.0 commit. Consultation is not publication or API execution.

Catalogue's original release `finally` resolves its completion gate even when the
adapter rejects. Its plain readiness holds are not bound to scope cancellation,
and callbacks/clients/workspace cleanup lack one observed lifetime owner.
Source recommends controls for ending-before-readiness, failed release, cancelled
holds, startup/registration refusal and original Error/null preservation. Do not
claim these source observations reproduce an earlier timeout or production defect.

Use the existing scoped work/startup observer/workspace/rollback helpers. Reconcile
manual captured leases after held work drains, and request client discard after
uncertain BEGIN/ROLLBACK. A discard request is not a server-side close certificate.
Keep refreshed activity polling serial on an idle holder, with abort checks and
drain before rollback. Expected-negative work must keep its original rejection
observable while cleanup separately waits for settlement.

## Options, recommended stack and remaining proof

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Common ownership helpers with empty schema | Repairs fixture lifetime without changing baseline preparation | Prove adverse controls first |
| Existing private migration source and fresh clones after ownership proof | Can reduce repeated migrations | Keep lineage, actual idempotent calls, fresh seeds and measured matching cases |
| Reused seeded database, persistent cache or more concurrency | Less apparent setup | Unproved state/ownership/capacity; defer |

Recommended stack: narrow ESM fixture adapters over the existing scan worker and
scoped lifecycle, workspace and transaction-client owners; existing private
migration-template owner; independent clone pools/seeds; native serial file
processes and the existing parent database registry. No new engine or production
schema behavior. Source complete-ledger verification differs from the clone's
applied-filename idempotent check, as recorded in the
[preceding schema research](LIBRARY_TEST_SCHEMA_TEMPLATES_RESEARCH_2026_10.md).

Required owning evidence includes preserved real scan/byte/tag/tombstone/source
assertions, lifecycle failure/cancellation and actual lease/rollback cleanup,
clone isolation after faults, refused changed source before seeding, and matching
registered/released databases. Compare the same cases/order/deadlines and schema
phase versus whole-group timings. Nested spans are not additive wall time. Local
matched runs do not prove CI capacity or whole-gate savings. This researcher
executed none of those controls or measurements.

## Retained evidence

Fresh searches, opened/navigation responses, exact sources, host/lockfile versions
and pre-change catalogue source observations:
`.tmp/catalogue-test-lifecycle-2026-10/official-research.json`.
SHA256: `98117719cd55597bbdf22d23cbe70af7649a6bfde17b47cc5dfd013e20bb67de`.
Recorded **22:08:13 UTC**; observed host time
`2026-10-10T18:07:45.0120043-04:00`.
The [separate PR outcome](OPEN_PR_APPLICABILITY_CATALOGUE_LIFECYCLE_2026_10_OUTCOME.md)
owns eligibility. Only assigned docs and ignored raw evidence were written.

Clean W3C reference verified **22:09:52–22:10:06 UTC**, October 10: fresh MCP
search returned the official Understanding index; opening it and following its
actual 4.1.3 link returned the query-free URL used above. It was not constructed
by stripping a query or guessing an extension. Initial raw evidence is retained.
Fresh navigation: `.tmp/catalogue-test-lifecycle-2026-10/w3c-canonical-status-navigation.json`,
recorded **22:10:19 UTC**.
SHA256: `d11eadb5f7d24432c500679b3b7d1e4d9f07c3ff19c250c40d9ff6887d94e97e`.
