# Library test schema templates research

October 10, 2026, America/New_York. Parent-supplied baseline: `d1b8dee`.
Consultation began at **21:02:49 UTC / 17:02:49 EDT**. The verified draft was saved
at **21:03:29 UTC**, before new library-template runtime changes. Final evidence
was recorded at **21:05:33 UTC**. Research and parent execution are separate.

## Early recommendation

Extend the existing migration-template owner only to explicitly selected library
fixtures whose database, worker, gate and workspace ownership was proved in the
preceding cohort. Keep independent scenario databases/pools, serial file execution,
original assertions and deadlines. A template contains the migrated baseline,
including any migration-defined seed rows, rather than a scenario's prepared data.
This recommendation is a project inference, not a measured saving.

PostgreSQL cloning requires the source to have no other connected sessions.
Closing its preparation pool, disabling new source connections, then verifying
source identity and zero sessions gives a checkable admission sequence. Disabling
connections does not terminate sessions already present. Keep the private source
owned by its creating role rather than granting broad template-cloning eligibility.
[PostgreSQL 18 template contract](https://www.postgresql.org/docs/18/manage-ag-templatedbs.html).

Preserve source encoding/locale compatibility. Database-level settings and GRANTs
are not copied; a scenario requiring such settings must establish them on its own
clone. CREATE DATABASE is outside a transaction block, so creation acknowledgment,
current database identity and cleanup are separate ownership steps.
[CREATE DATABASE](https://www.postgresql.org/docs/18/sql-createdatabase.html),
[ALTER DATABASE](https://www.postgresql.org/docs/18/sql-alterdatabase.html).

Build every clone pool from the owned connection configuration and its clone
name. Retain explicit independent clients for concurrency actors and one serialized
client for each transaction. End the source pool before publishing it; await
scenario work and pool closure before deleting the clone. Do not spread internal
pool options as an authority or credential transport.
[Official Pool API](https://node-postgres.com/apis/pool),
[transaction guidance](https://node-postgres.com/features/transactions).

Keep the actual idempotent migration check in each selected scenario after cloning;
the copied migration ledger must prove the baseline matches current inputs. A
schema template does not replace migration/bootstrap/recovery correctness tests.
Keep an explicit empty-schema comparison path and reject changed migration lineage
or source OID/role. Exact migration-ledger behavior is project code evidence to be
recorded below, not a PostgreSQL guarantee.

Register worker completion before startup and drain controlled work before clone
or workspace cleanup. Native test cancellation requests cooperative stop and does
not certify that all SQL/filesystem work settled. Do not increase concurrency or
weaken timeouts/assertions to make a schema optimization pass.
[Exact Node 24.18.1 test API](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/test.md),
[preceding cohort research](SHARED_POSTGRES_COHORT_ADOPTION_RESEARCH_2026_10.md).

## Version and scope limits

Fresh read-only host observation: Node `v24.18.1`, npm `12.0.2`, at
`2026-10-10T17:02:49.5013843-04:00`. PostgreSQL links are version 18 vendor
contracts/documentation, pg pages official library guidance, and the Node API is
an immutable source version. They do not establish a newly queried server version.
CREATE/ALTER DATABASE are PostgreSQL extensions, not general SQL-standard claims.

Lockfile observation: pg `8.23.0`, pg-pool `3.14.0`, Testcontainers and its PostgreSQL
module `12.1.0`. Fresh official PostgreSQL home navigation labels the versioned
documentation **18.6**; this is distinct from any inherited executed 18.3 server
evidence. No new server was queried. Earlier template/launcher outcomes remain
inherited evidence, not a rerun by this researcher.

This researcher ran no tests, PostgreSQL/Docker, app/runtime/test edits or Git
commands, and made no external writes. No UI changes or frontend conformance
claim are part of this CLI/test-fixture slice. The parent owns design,
implementation and executed measurements.

## Existing migration and connection source evidence

Read-only inspection of `migration-template-preparation.js` shows preparation
applies pending migrations and verifies the complete captured filename, migration
key, checksum and applied-status ledger. `migration-template-inputs.js` captures
the ordered manifest and source fingerprint; the template owner compares lineage
before sealing and clone admission. These are project source observations,
not executed database proof or automatic guarantees supplied by CREATE DATABASE.

`applyPendingMigrations` itself finds pending work by applied filenames and returns
the pending list. Its repeated call is an idempotent check under a matching copied
ledger; it is not independently a checksum-drift validator. Keep the owner's
complete-lineage verification and avoid describing the clone's filename check as
a new schema correctness proof. Preserve migration-defined baseline rows while
keeping scenario data, workers and mutations out of the source.

The existing owner builds clone pools from owned environment/connection config.
Installed pg-pool source makes its password option non-enumerable, so copying
`pool.options` with object spread can lose it. That source observation supports
explicit config construction; it exposes no password value. Inspected
`node_modules/pg-pool/index.js` SHA256:
`6f304776edaabde2954cbf8c4366fa6d9512bfba0e408e78cc56b3c46c69d058`.
The [Pool API](https://node-postgres.com/apis/pool) documents lazy clients, explicit
release and pool shutdown; those lifecycle steps still require observed completion.

## Source classification and applicability

| Fresh source | Classification | Bounded use |
| --- | --- | --- |
| PostgreSQL CREATE/TEMPLATE/ALTER links above | Version 18 vendor command/catalog documentation; PostgreSQL extensions rather than SQL-standard guarantees | Source connection exclusion, clone settings/locale, private source ownership |
| [Database catalog](https://www.postgresql.org/docs/18/catalog-pg-database.html) and [DROP DATABASE](https://www.postgresql.org/docs/18/sql-dropdatabase.html) | Version 18 vendor documentation | Current OID/role and independent cleanup; DROP is outside transactions and cannot target the connected database |
| pg Pool/transaction links above | Official library API/guidance; lockfile versions separately observed | Owned config, distinct pools and one serialized transaction client |
| Exact Node test API above and [AbortSignal API](https://github.com/nodejs/node/blob/9623d9ad85d37d2f0610ec4a82b48182cf2c6061/doc/api/globals.md) | Immutable 24.18.1 vendor API documentation | Process isolation, cooperative cancellation, async activity and observed drainage |
| [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Informative guidance | Bounded phase/result evidence; exclude tokens, credentials and connection strings |
| [W3C status-message explanation](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html?trk=article-ssr-frontend-pulse_little-text-block) | Informative WCAG 2.2 explanation | Applicability only: test/CLI evidence is not browser status or assistive-technology conformance |

Primary URLs were freshly reopened from previously discovered MCP links or reached
through official navigation. Node sources were fetched through GitHub MCP at
commit `9623d9ad85d37d2f0610ec4a82b48182cf2c6061`; test API blob
`96178f2a56515f0c87a5060843a755642ef31eca`, globals API blob
`8b96e41bed3f365d54967fc3e1e96d5ca30de6b7`. Consultation is not publication.

Native test results can precede outstanding asynchronous activity. A signal can
abort supported subtasks; it does not certify SQL/worker settlement. Retain the
existing explicit serial file loop, worker completion registration, cooperative
gate release and actual drainage before clone cleanup. A failed or cancelled
template preparation must not publish a source; preserve the original Error/null
when secondary cleanup fails. Current identity checks do not promise atomic
protection against a privileged administrator replacing an object during DDL.

## Tradeoffs and evidence still required

| Choice | Benefit | Limit |
| --- | --- | --- |
| Existing owner on a named audited library cohort | Amortizes migrated baseline preparation | Needs actual clone isolation, lineage and cleanup proof for that cohort |
| Empty-schema comparison | Preserves the original preparation path | More repeated migration work; not a reason to weaken assertions |
| Global/default template or seeded-source reuse | Broad startup reduction | Includes unproved owners or scenario state; defer |

Required owning evidence includes unchanged real cases, per-clone idempotent
returns, copied ledger/constraint parity, isolated scenario mutations, source
replacement/lineage refusal, cancellation and strict cleanup. Compare matched
order/counts and measured preparation/whole-group timings before claiming savings.
This research does not promote CI/default configuration or a wider concurrency
profile. Dedicated migration/bootstrap/recovery tests keep their original owners.

## Retained evidence

Raw official navigation/source responses, host/version reads and existing-source
observations: `.tmp/library-test-schema-templates-2026-10/official-research.json`.
SHA256: `67bd872d7b05921ddf2f93c1bf1549502e62160bb96fb641e280492151738aab`.
Recorded **21:05:33 UTC**; observed host time
`2026-10-10T17:05:02.1627186-04:00`.
The separate [PR outcome](OPEN_PR_APPLICABILITY_LIBRARY_TEMPLATES_2026_10_OUTCOME.md)
records current eligibility. No researcher-executed test/database/benchmark claim.
