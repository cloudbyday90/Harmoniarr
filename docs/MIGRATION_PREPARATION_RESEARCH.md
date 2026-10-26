# Migration preparation: research

Reviewed October 26, 2026. Primary URLs were discovered with MCP search and opened
before use. [Design](MIGRATION_PREPARATION_DESIGN.md) and
[outcome](MIGRATION_PREPARATION_OUTCOME.md) are separate records.

## Official sources and application decisions

| Source | Relevant practice | Application |
| --- | --- | --- |
| [Flyway Validate On Migrate](https://documentation.red-gate.com/fd/flyway-validate-on-migrate-setting-277579048.html), updated October 21, 2026 | Validation before migration is enabled by default. | Check existing history before ensureSchemaTable or pending SQL, using the existing ESM runner. No Flyway dependency is added. |
| [Flyway Validate](https://documentation.red-gate.com/flyway/reference/commands/validate), updated October 21, 2026 | Available migration identities and checksums are compared with applied history. | Reject unknown applied rows and checksum/key drift while allowing known absent pending files. Keep Harmoniarr's existing SHA-256. |
| [Flyway Repair](https://documentation.red-gate.com/flyway/reference/commands/repair), updated October 21, 2026 | Repair changes history; leftover user objects may still need manual cleanup. | Separate reviewed failed-SQL retry from history repair. Do not realign checksums, delete history or drop application data automatically. |
| [PostgreSQL 18 pg_class](https://www.postgresql.org/docs/18/catalog-pg-class.html) | Catalog relation kinds distinguish tables, views, materialized views, foreign tables and sequences. | Classify public schema contents through catalogs, including objects hidden from information_schema by limited permissions. A missing ledger in a nonempty schema must not trigger initialization. |
| [PostgreSQL 18 BEGIN](https://www.postgresql.org/docs/18/sql-begin.html) | BEGIN inside an existing transaction produces a warning; savepoints provide nesting. | The existing writer/file transaction overlap needs its own atomicity qualification next. This guard does not establish rollback or commit guarantees. |
| [OWASP Database Security](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html) | Operations should use only necessary privileges. | The guard uses SELECTs on the captured writer connection; no DDL privilege is required for observation and no second pool is added. |
| [W3C WCAG 2.2](https://www.w3.org/TR/wcag/) | Web status feedback needs programmatic identification without moving focus. | Existing UI feedback remains applicable. This CLI/preparation change adds no markup or assistive-technology acceptance claim. |

This architecture is our inference from those sources and the repository. The
previous startup assertion ran after Docker preparation. Preparation itself still
replaced the UUID function and could apply pending SQL before discovering drift.
It also silently retried failed rows and did not consistently forward its pool
factory. The new guard belongs before writer DDL, with a check before empty-schema
snapshot bootstrap as well.

## Options and tradeoffs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Read-only guard on the captured writer connection | Refuses before DDL; reuses existing report/store; pending upgrades still work | Does not coordinate another writer after its observation | Implement; deployments must quiesce writers |
| Keep only the post-preparation startup guard | Smaller change | Pending SQL can run before inconsistent history is rejected | Reject |
| Automatically retry every non-applied row | Convenient restarts | Running/unknown/incompatible states can be replayed without review | Reject |
| Explicit retry of known unchanged failed SQL | Preserves an operator recovery path without changing history | Requires review of the failure, rollback and leftover objects; does not promise idempotency | Implement as one CLI invocation |
| Automatically repair checksums or discard history | Can make validation pass | Removes evidence without proving schema compatibility | Reject |
| Shared writer lock and transaction ownership redesign | Could protect concurrent preparation and atomic ledger publication | Changes transaction/lifetime protocols across bootstrap, migrations and recovery | Follow-up work |

Recommended stack: immutable manifest capture → catalog classification → read-only
applied-history validation → explicit failed-row consent if needed → preparation
DDL/pending SQL → existing post-preparation startup validation. Keep fixed bounded
failure guidance. Default Docker startup never opts into failed retry; only the
exact explicit migration command can own that preparation attempt.

No release, migration SQL change, new service, dependency or production role is
needed. Next investigate transaction ownership: repository SQL files include
BEGIN/COMMIT while the writer also wraps transactions. Qualify that DDL and its
ledger receipt commit together before claiming atomic failure/retry behavior.
