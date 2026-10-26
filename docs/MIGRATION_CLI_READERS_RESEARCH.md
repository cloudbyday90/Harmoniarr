# Migration CLI readers: research and recommendation

Reviewed October 26, 2026. Primary URLs below were discovered with the MCP search
service and opened before use. This document records guidance and tradeoffs;
[design](MIGRATION_CLI_READERS_DESIGN.md) and
[outcome](MIGRATION_CLI_READERS_OUTCOME.md) are separate records.

## Evidence and applicability

| Official source | Relevant guidance | Application |
| --- | --- | --- |
| [PostgreSQL 18 SET TRANSACTION](https://www.postgresql.org/docs/18/sql-set-transaction.html) | Read-only transactions reject persistent table writes and CREATE/ALTER/DROP, GRANT and REVOKE. This does not promise zero disk writes. | Diagnostic SELECTs must work without schema preparation. Use native read-only qualification; make no filesystem-write-free claim. |
| [PostgreSQL 18 connection defaults](https://www.postgresql.org/docs/18/runtime-config-client.html) | default_transaction_read_only controls the initial access mode of each transaction. | Give the disposable observer role a read-only default, exercising actual new CLI connections. |
| [PostgreSQL 18 CREATE ROLE](https://www.postgresql.org/docs/18/sql-createrole.html) | Role attributes govern superuser, database and role creation privileges; roles are cluster-scoped. | Use a restricted observer only in the admitted disposable container. Never create the test role in the preserved deployment. |
| [OWASP Database Security](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html) | Database accounts should receive the minimum necessary permissions. | Remove unnecessary DDL dependencies from observation; qualify SELECT-only ledger access. A production credential split remains a separate operational change. |
| [Node.js 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html) | Child close follows process termination and closure of its stdio streams; exit alone can precede stdio closure. | Run real packaged CLI children with execFile, inspect completed output and exit codes, and reject signal/timeout termination as success. |
| [W3C WCAG 2.2](https://www.w3.org/TR/wcag/) | Markup status messages need programmatic identification without moving focus (4.1.3). | Existing onboarding status/focus behavior remains applicable. This backend/CLI change adds no UI; CLI exit codes are not WCAG acceptance evidence. |

Repository inspection found that status, checksum and full-state helpers called
ensureSchemaTable. That operation creates an extension, replaces the UUID function
and creates the ledger. Repeated diagnostic calls therefore required write
privileges and could contend on catalog objects even against prepared databases.
Removing that dependency is our engineering recommendation derived from the
sources and the actual call graph, rather than a prescription for this application
from PostgreSQL or W3C.

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Narrow read-only modules with compatibility exports | Removes hidden preparation; keeps callers and response shapes; uses existing store and pool | An absent ledger now reports failure instead of being created by a read | Implement |
| Keep preparation and serialize/retry diagnostics | Small call-site change | Retains elevated privileges and hidden mutation; retries cannot make a read safe | Reject |
| Introduce a separate production observer pool/role now | Database-enforced least privilege | New credential, rotation, deployment and pool ownership; exceeds this focused repair | Defer; native fixture qualifies compatibility first |
| Change diagnose into a strict readiness gate | One strict command | Breaks existing report-only exit semantics and automation | Defer; use existing strict commands |
| Add full-lineage startup validation immediately | Could refuse checksum or unknown-row inconsistencies before listening | Changes availability policy beyond removing side effects; needs explicit bootstrap/recovery compatibility qualification | Next design item |

## Recommended stack

Explicit bootstrap/migrate preparation → read-only status/checksum/full-state
services → SQL-only store reads → existing CLI reporting and cleanup → actual
restricted-role process qualification. Keep startup pending/missing-state failure
fatal. Preserve original query Error/null if client release also fails.

The implementation uses internal ESM files in the existing application. It adds
no app, network service, production role, pool, schema migration or dependency.
The next recommendation is to design full-lineage startup validation: current
startup checks pending filenames, while checksum and unknown-row validation are
separate tools. Decide its recovery/availability policy before enforcing it.
