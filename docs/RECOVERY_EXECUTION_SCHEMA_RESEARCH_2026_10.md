# Recovery execution schema research

Consulted 2026-10-15 through MCP search/open and GitHub repository metadata.
Installed Node 24.18.1 and npm 12.0.2 are retained; no dependency upgrade is chosen.

| Official source and status | Relevant practice | Application |
| --- | --- | --- |
| [PostgreSQL 18 CREATE DATABASE](https://www.postgresql.org/docs/18/sql-createdatabase.html), versioned maintainer documentation | Template copying requires no other connected source sessions; database settings/permissions are not inherited | Reuse the sealed migration-only owner, fresh clones and explicit runtime pool policy |
| [Node 24 test runner](https://r2.nodejs.org/docs/latest-v24.x/api/test.html), maintainer documentation, opened 24.22.0 | Test result reporting does not wait for asynchronous work that outlives the test | Retain actual worker completion and observed/drained native operations beyond cancellation; use APIs available on installed 24.18.1 |
| [W3C High Resolution Time 3](https://www.w3.org/TR/hr-time-3/), Working Draft 2026-09-01 | Monotonic clocks support durations; separate executions have distinct clock origins | Use existing monotonic observers and per-process elapsed durations, without summing overlapping spans |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Exclude passwords/connection strings and contain logging failures | Keep private raw evidence and approved aggregate output; observers cannot replace the original Error/null |

These fixture choices are project decisions inferred from official contracts and
local ownership evidence. W3C's document is a draft, not a Recommendation or an
endorsement of database templates. No user-facing control changes, accessibility
certification or general security certification are implied.

## Options and recommendation

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Instrument empty databases only | Simple comparator; exercises all migrations seven times | Repeated schema work | Retain explicit empty mode |
| Existing migration-only template, scoped to execution | Amortizes schema preparation while preserving real commits and isolated worker state | Extra source/verification/cleanup and adoption proof | Evaluate native drainage/isolation and both-order measurements before promotion |
| Share seeded mutable state | Lower apparent setup cost | Leaks authority, runs/leases/faults; changes rollback/race semantics | Reject |
| Expand parallelism or shared-parent allowlist now | Potential wider savings | Adds unmeasured contention or ownership scope | Defer |
| New worker lifecycle/template engine | Separate tuning | Duplicates actual-completion and sealed-source owners already present | Reject |

Recommended stack: independent scoped policy → verified migration-only source →
fresh clone/pool → idempotent migration check → fresh context/seeds → actual
worker/service completion → unchanged assertions → awaited strict release.

Opening GitHub MCP collection read returned zero open PRs. Refresh before commit.
See [design](RECOVERY_EXECUTION_SCHEMA_DESIGN.md) and
[outcome](RECOVERY_EXECUTION_SCHEMA_OUTCOME.md).
