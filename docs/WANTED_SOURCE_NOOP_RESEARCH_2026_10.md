# Wanted source no-op research

Consulted 2026-10-13 through connected MCP search and opened official pages.
Host Node: 24.18.1; npm: 12.0.2. PostgreSQL 18 guidance applies to the native
fixture's major version; deployed version is verified separately in validation.

| Practice and source status | Application decision | Benefit / cost |
| --- | --- | --- |
| [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html), engine documentation | Hold the exact source row until publication ends; use the existing advisory-before-source order | Prevents concurrent predicate changes; later writers can wait |
| [PostgreSQL SELECT](https://www.postgresql.org/docs/18/sql-select.html), engine documentation | NOWAIT for the optional row proof, with savepoint recovery | Avoids a new row-lock wait; table locks can still wait and fallback remains conservative |
| [PostgreSQL isolation](https://www.postgresql.org/docs/18/transaction-iso.html), engine documentation | READ COMMITTED, exact row predicate and transaction-bound proof | Fresh committed state; a plain snapshot alone cannot grant a skip |
| [PostgreSQL savepoints](https://www.postgresql.org/docs/18/sql-savepoint.html) and [release](https://www.postgresql.org/docs/18/sql-release-savepoint.html), engine documentation | Recover only a busy optional lock, retain successful locks through outer commit | Safe fallback; adds serial SQL overhead |
| [node-postgres transactions](https://node-postgres.com/features/transactions), driver documentation | All proof, guard, mutation and event work uses the same owned client | Atomic rollback; pool convenience queries cannot substitute |
| [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), informative security guidance | Keep current owner, saved scope and final publication authority; unknown proof falls back | Limits stale authority; intentionally narrow eligibility |
| [W3C High Resolution Time 3](https://www.w3.org/TR/2026/WD-hr-time-3-20260901/), Working Draft of 2026-09-01 | Retain monotonic duration measurements; keep lease wall-clock authority separate | Comparable elapsed windows; timings remain observations, not safety gates |
| [PostgreSQL 18 connection logging](https://www.postgresql.org/docs/18/runtime-config-logging.html), engine documentation | Follow-up: capture receipt/authentication/authorization and setup duration on owned fixtures, with private correlation and fixed sanitized output | Narrows cold-checkout diagnosis; raw logs contain identity data and a successful later probe is not historical proof |

W3C browser timing semantics inform measurement; they do not define PostgreSQL
locking or establish application conformance. No browser interaction changes
require a new WCAG claim in this slice. Project choices below are inferences from
these sources and inspected callers, rather than prescribed standards.

## Options and final recommendation stack

1. **Adopt a locked positive-source no-op proof.** It removes entire unnecessary
   projections while preserving both hashes at retained boundaries. Costs are
   savepoint SQL and source-row contention. Begin with already-existing positive
   rows; negative and other shapes remain conservative.
2. **Keep complete final verification and guarded actual writes/events.** This
   preserves current policy, bytes and job authority. Hashing remains significant
   for large media, but cached bytes would require a separate availability contract.
3. **Keep compatibility comparison and explicit scaling.** Exact durable results
   and counted hashes matter more than elapsed-only claims. Controlled media and
   two descriptive matched pairs are not cold-storage or whole-CI performance.
4. **Add bounded server-side cold-start evidence next.** The current failed
   matrix reached client startup dispatch without an authentication response.
   Correlate the original connection with server receipt/authentication/backend
   setup before attributing a cause. Keep resource bounds and failed runs intact.
   Connection logging is a proposal for owned fixtures, not a setting changed here.
5. **Reject snapshot-only, historical-marker or absent-row shortcuts.** They are
   cheap but leave a concurrent writer gap. A broader source-state protocol needs
   its own proof before expanding eligibility.

The [design](WANTED_SOURCE_NOOP_DESIGN.md) owns the implementation contract;
the [outcome](WANTED_SOURCE_NOOP_OUTCOME.md) records actual executed evidence.
