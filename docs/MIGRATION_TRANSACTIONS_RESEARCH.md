# Migration transaction ownership research

Researched October 26, 2026. Official URLs were discovered and opened through
the connected search MCP service. These recommendations apply to the packaged
PostgreSQL 18 and pinned node-postgres 8.23.1; they do not prescribe a database
major upgrade. See the separate [design](MIGRATION_TRANSACTIONS_DESIGN.md) and
[outcome](MIGRATION_TRANSACTIONS_OUTCOME.md).

## Findings and application

PostgreSQL does not nest transactions when a second BEGIN is issued. COMMIT
ends the current transaction. Therefore, wrapping a file that already commits
can separate its DDL from the executor's subsequent applied receipt. That last
sentence is our inference for the old Harmoniarr writer. Sources:
[BEGIN](https://www.postgresql.org/docs/18/sql-begin.html) and
[COMMIT](https://www.postgresql.org/docs/18/sql-commit.html).

Command boundaries must respect strings, quoted identifiers, nested comments
and dollar-quoted procedural bodies. Our compiler supports those lexical forms
and fixes ordinary-string interpretation locally before execution. It is a
policy for trusted repository migrations, not a general SQL parser or sandbox.
Source: [PostgreSQL lexical structure](https://www.postgresql.org/docs/18/sql-syntax-lexical.html).

Use one checked-out client throughout each transaction. The public transaction
status API reports idle, active, failed or unknown state after protocol readiness;
the client also needs connection-lifetime error handling between queries.
Harmoniarr uses those states to refuse a borrowed transaction and discard an
uncertain connection. Sources: [transactions](https://node-postgres.com/features/transactions),
[client API](https://node-postgres.com/apis/client) and
[pool release](https://node-postgres.com/apis/pool).

A communication failure can hide whether the server committed. Our conservative
policy is to discard that connection, stop and inspect recorded history through
an independent maintenance connection. Sending ROLLBACK or writing a failed
receipt cannot establish the outcome of a COMMIT already sent. This is an
application inference from the [PostgreSQL protocol overview](https://www.postgresql.org/docs/18/protocol-overview.html).
Set synchronous_commit locally to on; acknowledgement still depends on server
fsync, storage and replication configuration. Source:
[WAL settings](https://www.postgresql.org/docs/18/runtime-config-wal.html).

For the next item, an application-defined advisory lock can coordinate cooperating
preparers. Session locks survive individual transaction boundaries and require
explicit release or connection termination; transaction locks end with their
transaction. Our inference is that the preparation owner must cover the entire
bootstrap/admission/write lifetime and dispose its connection if release is
uncertain. A lock cannot constrain external writers that ignore the protocol.
Source: [PostgreSQL advisory locks](https://www.postgresql.org/docs/18/explicit-locking.html).

Continue parameterized ledger values, restricted database access and separation
of privileged maintenance from public diagnostics. No credentials or SQL bodies
are added to the fixed uncertain-commit message. Least privilege remains an
architectural requirement, not a claim that the lexical compiler confines
arbitrary migration SQL. Source:
[OWASP database security](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html).

W3C recommends WCAG 2.2 for current accessibility policies. This backend change
adds no screen or markup and makes no new accessibility-conformance claim.
Any later recovery UI should preserve keyboard focus, understandable errors and
programmatically exposed status. Manual speech/device acceptance remains
deferred under the existing fixture workflow. Source:
[WCAG 2.2](https://www.w3.org/TR/wcag/).

## Options and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Rewrite historical SQL to remove wrappers | Simple runtime | Breaks recorded checksums and installed lineage | Reject |
| Let SQL files own commits | Preserves file text | Cannot atomically append the executor's applied receipt | Reject |
| Compile recognized framing in memory; executor owns one transaction | Preserves lineage; DDL and receipt share visibility and rollback | Small lexical policy to maintain; unsupported forms refuse before writes | Implement |
| Adopt a full SQL parser now | Broader grammar | More dependency/version work; still cannot sandbox function effects | Defer until a demonstrated grammar need |
| Automatically retry after a lost COMMIT acknowledgement | Convenient on transient errors | Can replay committed effects or overwrite truthful history | Reject |
| Serialize cooperating preparation writers | Prevents concurrent stale-plan decisions | Requires one lock lifetime across bootstrap, guard and writes | Next item |

Recommended order: immutable manifest and history guard → preflight all pending
SQL → one owned connection/transaction per migration → checked applied receipt
and acknowledged COMMIT → discard and independent observation on ambiguity →
cooperative preparation serialization. Keep operational recovery explicit.
