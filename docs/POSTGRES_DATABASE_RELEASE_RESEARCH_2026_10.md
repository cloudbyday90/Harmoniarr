# Strict database release official research

Consulted 2026-10-15 through MCP search/opening and GitHub repository metadata.
All links were discovered through those services. Installed Node is 24.18.1,
npm 12.0.2 and pg 8.23.0; the local Linux Docker Engine is 29.8.2. Fixture policy
continues to select PostgreSQL 18 with two pool clients and existing deadlines.

| Primary source and status | Applicable practice | Project application |
| --- | --- | --- |
| [PostgreSQL DROP DATABASE](https://www.postgresql.org/docs/current/sql-dropdatabase.html), official documentation opened as PostgreSQL 18 | DROP requires database-owner authority, cannot run inside a transaction, and may fail when sessions remain; FORCE has limits | Keep existing acknowledged creation/drain/drop boundaries; test a real permission refusal without adding FORCE or a retry |
| [node-postgres pool API](https://node-postgres.com/apis/pool), maintainer documentation | Await pool.end to drain clients, disconnect and close pool timers; checked-out clients must be released | Preserve awaited pool closure before database release and report failure instead of assuming successful callback means successful disposal |
| [node-postgres client API](https://node-postgres.com/apis/client), maintainer documentation | Query and disconnect operations expose promise failures | Await the admin-close tail and retain original failure identity |
| [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), W3C Statement dated 2025-05-15 | Minimize transferred data | Keep connection configuration, generated target identities and raw query/error details private; publish bounded validation results |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), informative security guidance | Exclude secrets and connection strings; verify failure handling in diagnostics | Keep current minimized diagnostic behavior; the correction adds no raw connection logging |

Our cleanup precedence and strict selection are engineering decisions inferred
from those sources and repository evidence. W3C's Statement does not prescribe
PostgreSQL fixture disposal. This infrastructure change introduces no browser
interaction or claim of WCAG conformance. Unversioned maintainer pages may show
APIs newer than the installed driver; this change uses existing end/query APIs.

## Options, pros and cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Select the existing strict policy at the shared empty-schema boundary | Small review surface; uses established order/precedence; catches false success | Previously hidden cleanup failures now fail fixture validation | Implement |
| Change the helper's global default | Covers every direct consumer | Broad compatibility change beyond the selected runtime; needs separate caller audit | Defer |
| Create a second disposal service | Could support future new ownership rules | Duplicates an existing lifecycle and increases drift | Reject for this correction |
| Retry DROP, use FORCE or extend deadlines | May conceal some cleanup symptoms | Changes work/authority and cannot prove all failures recover | Reject |
| Replace primary errors with an aggregate | Shows multiple errors together | Breaks Error/null identity and current failure contracts | Reject |

Recommended stack: shared ESM runtime selects strict release → existing helper
awaits all cleanup stages → original scenario/first cleanup failure stays primary
→ existing owned server teardown → independent workspace guards → container-free
failure matrix plus bounded real PostgreSQL permission/retention proof.

See [design](POSTGRES_DATABASE_RELEASE_DESIGN.md) and
[outcome](POSTGRES_DATABASE_RELEASE_OUTCOME.md).
