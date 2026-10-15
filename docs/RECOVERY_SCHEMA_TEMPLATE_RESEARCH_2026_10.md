# Recovery schema timing and template research

Consulted 2026-10-15 through MCP search, official navigation and GitHub metadata.
Host Node is 24.18.1 and npm 12.0.2; retain PostgreSQL 18 and installed driver/
Testcontainers contracts. No dependency or release change is selected.

| Primary source/status | Applicable practice | Project decision |
| --- | --- | --- |
| [PostgreSQL 18 CREATE DATABASE](https://www.postgresql.org/docs/18/sql-createdatabase.html), versioned maintainer documentation | TEMPLATE copies a database; cloning requires no connected source sessions; database settings/permissions are not copied | Reuse the private migration-only sealed template and existing per-clone/pool setup; fresh scenario seeds remain mandatory |
| [PostgreSQL 18 ALTER DATABASE](https://www.postgresql.org/docs/18/sql-alterdatabase.html), versioned maintainer documentation | ALLOW_CONNECTIONS false prevents connections; IS_TEMPLATE affects who may clone | Preserve current private owner/sealing checks and test reopened-source refusal, without treating sealing as protection against administrators |
| [Node 24 test runner](https://r2.nodejs.org/docs/latest-v24.x/api/test.html), maintainer documentation | Native final summaries/case events and process isolation have distinct contracts; async work may outlive reported tests | Keep serial file processes, exact native signatures, zero skips and actual returned work/cleanup completion |
| [Testcontainers lifecycle](https://node.testcontainers.org/features/containers/), maintainer documentation | Bounded explicit stop waits for shutdown; reuse and automatic cleanup are separate | Keep fresh owned servers/parents, existing deadlines and awaited release |
| [W3C High Resolution Time 3](https://www.w3.org/TR/hr-time-3/), Working Draft dated 2026-09-01 | Monotonic durations avoid wall-clock adjustment; clock origins differ | Use the existing monotonic controller/observer and qualify nested phase totals and two local pairs |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Exclude credentials/connection strings and verify observer failure handling | Publish numeric evidence/case hashes; retain private native logs and original Error/null |

These template-selection and evidence requirements are project engineering
choices inferred from the sources and local code. W3C's document is a Working
Draft, not a Recommendation or endorsement of this fixture strategy. No browser
accessibility or blanket security certification is claimed.

## Options, pros and cons

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Instrument fresh empty databases only | Simple baseline; exercises migrations per scenario | Repeats schema work fourteen times | Keep as comparator/explicit fallback |
| Reuse existing migration-only templates for recovery | Amortizes schema preparation; retains real independent committed transactions | Adds one source database, verification/copy cost and cleanup ownership | Evaluate with both-order measurement and native isolation before selecting default |
| Persist seeded databases or share one mutable database | Potentially cheaper setup | Cross-case users/runs/faults and weaker isolation; changes real race/commit behavior | Reject |
| Broaden global templates or parallelism | Wider potential savings | Unreviewed consumers and contention; exceeds the measured boundary | Defer |
| Add a second template engine | Independent tuning | Duplicates existing fingerprint/sealing/lifetime authority | Reject |

Recommended stack: scoped mode policy → existing prepared-template owner → fresh
clone/pool → idempotent migration check → fresh recovery context/seeds → unchanged
native SQL assertions → awaited strict release → qualified paired evidence.

Opening GitHub MCP collection read found zero open PRs; refresh before commit.
See [design](RECOVERY_SCHEMA_TEMPLATE_DESIGN.md) and
[outcome](RECOVERY_SCHEMA_TEMPLATE_OUTCOME.md).
