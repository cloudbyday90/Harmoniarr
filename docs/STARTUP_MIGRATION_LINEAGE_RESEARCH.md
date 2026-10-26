# Startup migration lineage: research

Reviewed October 26, 2026. URLs below were discovered through MCP search and opened
before use. [Design](STARTUP_MIGRATION_LINEAGE_DESIGN.md) and
[outcome](STARTUP_MIGRATION_LINEAGE_OUTCOME.md) are separate documents.

## Official evidence

| Primary source | Guidance | Application decision |
| --- | --- | --- |
| [Redgate Flyway Validate](https://documentation.red-gate.com/flyway/reference/commands/validate), updated October 21, 2026 | Applied migrations are compared with available files; names/checksums and missing applied versions affect validation. | Validate the complete prepared ledger, rather than only missing repository filenames. Retain Harmoniarr's SHA-256 implementation; add no Flyway dependency. |
| [Redgate Flyway Repair](https://documentation.red-gate.com/flyway/reference/commands/repair), updated October 21, 2026 | Repair changes history, including failed entries, checksums and missing records. | Treat repair as a distinct operator decision. Startup observation must not rewrite evidence to obtain a passing result. |
| [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html) | A plain SELECT at Read Committed observes a statement snapshot. | Read ledger state once and derive all categories from that same result. This does not prevent later external migration writes. |
| [PostgreSQL 18 SET TRANSACTION](https://www.postgresql.org/docs/18/sql-set-transaction.html) | Read-only transactions reject persistent mutation and DDL, without promising zero physical disk writes. | Retain the existing SELECT-only observer and restricted-role native proof. Do not add DDL, repair or an unnecessary transaction to startup validation. |
| [OWASP Database Security](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html) | Grant only the database privileges needed by an operation. | Reuse the read-only diagnostic service; do not require schema-write privileges for the guard or introduce a second privileged pool. |
| [W3C WCAG 2.2](https://www.w3.org/TR/wcag/) | Web status messages need programmatic identification without focus changes. | Keep existing onboarding feedback behavior. This startup change adds no markup, and CLI/process tests do not establish assistive-technology acceptance. |

These sources inform our policy; they do not mandate this application's startup
architecture. Repository inspection found that startup checked pending filenames
but accepted drifted checksums, unknown applied rows and incorrect migration keys.
The existing full-state report also collected migration_key without comparing it.
The chosen change closes those gaps with existing service/store ownership.

## Alternatives and tradeoffs

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Refuse inconsistent prepared state before app composition | Prevents HTTP commands and recovery/background workers from starting on a rejected ledger; one shared report | Deliberately removes HTTP/UI availability until the operator resolves compatibility | Implement |
| Log a warning and continue | Keeps the UI reachable | Allows writers against unresolved lineage | Reject |
| Automatically rewrite history/checksums | Restarts more databases automatically | Destroys evidence and can accept changed SQL without review | Reject |
| Run separate status and checksum queries | Reuses older assertions | Multiple snapshots, duplicate work, misses other row/key inconsistencies | Reject |
| Hold a database-wide lock or continuously revalidate | Could coordinate more external writes if all owners cooperate | Larger writer protocol, resource lifetime and availability changes | Defer; require quiescent migration/deployment ownership |
| Validate existing applied lineage before migration preparation writes | Can stop an upgrade before inconsistent history receives more writes | Needs a distinct policy allowing legitimate pending upgrades and explicit failed-migration retry | Next item |

## Recommendation stack

Existing explicit preparation/bootstrap → immutable local manifest → one read-only
ledger observation → shared checksum/key/status/unknown-row report → bounded fatal
startup assertion → path validation → app composition/listen/recovery workers.
Require a nonempty manifest. Give operators counts and explicit diagnostic guidance
without copying stored errors, filenames or checksums into automatic startup logs.

Availability policy: refusal also makes HTTP recovery unavailable. Retain an
independent diagnostic/maintenance path; use matching application files and a
verified compatible database or reviewed explicit migration work. Do not introduce
a bypass environment variable or automatically realign the ledger.
