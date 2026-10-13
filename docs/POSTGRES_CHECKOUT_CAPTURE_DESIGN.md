# Owned PostgreSQL checkout failure capture

October 13, 2026. Baseline main `ae1cd71`. The preceding reusable-fingerprint
cohort passed 110/112; migration setup and an automatic-discovery claim timed out.
Its separate 17/17 diagnostic run reproduced neither failure. This design closes
an observation gap, without claiming to remediate the historical timeout cause.

## Ownership and implementation

Keep production services and driver dependencies unchanged. A small ESM fixture
adapter observes `connect()` on an explicitly owned pool instance, preserving its
receiver, concrete clients/release functions and promise/callback APIs. Observe
callback acquisition too, because the installed driver's `pool.query()` uses it.
Never patch the driver prototype or replace the entire pool with a proxy/facade.
Restore the original own-property descriptor after owned fixture work drains.

Use fixture-local asynchronous phase context at admission; overlapping/nested
phases must remain distinct even when phase timing output is disabled. Records
contain generated fixture/checkout UUIDs, approved pool/source/phase labels,
before/dispatched/settled public counters, elapsed duration and bounded approved
error classes/codes. No SQL, connection strings, credentials, messages, endpoints,
database names or client identities. Default failure-only mode does not emit
successful records or probe successful work. Opt-in all-mode output has fixed
record budgets, with a separate failure budget; off-mode does not decorate pools.

On the first checkout failure per case, retain counters before probes, then await
the existing independent host/readiness/container probes before forwarding an
asynchronous failure. A distinct case-owned capture prevents an earlier unrelated
scenario rejection from consuming checkout evidence. Correlate the server record
to that checkout. Diagnostic exceptions cannot replace original Error/null.
Synchronous throws remain synchronous; drain admitted capture before restoration
and pool cleanup. No retry, pool/deadline increase, query replay or skipped test.

Wire direct isolated-database pools before exposing them to the callback, and
application pools before schema preparation in both app fixture entry points.
Keep the existing first-app-checkout observer for compatibility. Additional pools
created ad hoc by individual tests remain outside automatic observation.

## Verification and decision

Prove concrete identity/receiver, callback release/return semantics, query-path
acquisition, overlapping phases, exact Error/null, failed diagnostic sinks/probes,
held capture and descriptor restoration. Native controls must exercise a direct
migration connection and a later actual discovery claim, inspect records before
cleanup, and preserve real PostgreSQL resource bounds. Retain the previous failed
cohort separately from new controlled/affected evidence.

Recommended stack: owning fixture phase → concrete pool checkout → bounded
counter/error record → first-failure independent server capture → original
rejection/callback → owned worker drainage → diagnostic drain/restoration → pool
and database cleanup. The separate research/outcome documents record tradeoffs
and actual results. Main only; no release or PR merge.
