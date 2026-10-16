# Recovery discovery schema research

Consulted 2026-10-15 through MCP search/open and GitHub repository metadata.
Retain installed Node 24.18.1, npm 12.0.2, PostgreSQL 18 and existing dependencies.

| Official source/status | Applicable practice | Project decision |
| --- | --- | --- |
| [PostgreSQL 18 CREATE DATABASE](https://www.postgresql.org/docs/18/sql-createdatabase.html), versioned maintainer documentation | Cloning requires no other source sessions; database settings/permissions are not copied | Reuse sealed migration-only sources and explicit per-clone pool configuration |
| [Node 24 test runner](https://r2.nodejs.org/docs/latest-v24.x/api/test.html), maintainer documentation, opened 24.22.0 | Native reporting does not wait for asynchronous work that outlives a test | Keep the installed-compatible actual-completion helper and drain native operations beyond cancellation |
| [W3C High Resolution Time 3](https://www.w3.org/TR/hr-time-3/), Working Draft 2026-09-01 | Monotonic durations avoid wall-clock changes; executions have different origins | Reuse numeric monotonic spans; preserve domain wall-clock/deadline semantics separately |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Exclude credentials/connection strings and contain observer failures | Retain private raw evidence, bounded public aggregates and original Error/null |

The fixture strategy is a project decision inferred from these contracts and
local code. W3C's draft does not endorse this database strategy or require changing
the fixture's domain clock. No browser/accessibility or general security
certification is claimed.

## Options, pros and cons

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Instrument empty schemas only | Clear baseline; runs full migrations per scenario | Repeats schema setup fourteen times | Keep as explicit comparator |
| Existing migration-only source scoped to discovery | Amortizes setup with isolated committed reservation/worker state | Extra source, verification/copy/cleanup and adoption proof | Evaluate both orders and real completion/isolation before selecting default |
| Seeded shared mutable database | Apparent setup reduction | Leaks reservations/leases/authority and changes rollback behavior | Reject |
| New lifecycle/template engine | Separate tuning | Duplicates existing ownership and completion contracts | Reject |
| Shared-parent allowlist or parallelism expansion now | Potential wider savings | Requires another admission/registration/child-drain audit | Defer |

Recommended stack: scoped mode → verified migration-only source → fresh clone/
pool → idempotent schema check → unchanged custom context/clock → actual dispatch/
ingestion/release/pruning completion → unchanged assertions → strict awaited release.

Opening GitHub MCP collection read returned zero open PRs; refresh before commit.
See [design](RECOVERY_DISCOVERY_SCHEMA_DESIGN.md) and
[outcome](RECOVERY_DISCOVERY_SCHEMA_OUTCOME.md).
