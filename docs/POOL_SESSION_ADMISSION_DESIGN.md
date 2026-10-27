# Pool and session admission design

## Ordinary pool admission

`database-pool-admission-service.js` owns the policy and one counter per pool
generation. `database.js` attaches it once when lazily creating the native pool.
The adapter decorates public `connect`; native `pool.query` also uses that method.
Both callback and promise checkouts share the cap, including startup and pending
delivery. It preserves callback receiver/arguments, release function, native
Error/null failures and shutdown behavior. Counts retire once, before delivery.
Excess calls receive `database_pool_busy` immediately, without another queue.

The default native `connectionTimeoutMillis` is 5000. Explicit supported aliases
remain valid; zero, malformed integers and timer overflow are refused. The pending
cap defaults to 64 and is configurable through `HARMONIARR_PG_POOL_MAX_PENDING`.
Both baseline and walkthrough Compose forward the documented options. This cap
is per generation/process, not a distributed quota or the number of active SQL
queries. `max` still governs native active clients. No global query timeout or
automatic retry is introduced; the shutdown generation fence remains intact.

## Fresh session reads

`auth-session-store.js` owns the parameterized, public-qualified, one-row token
lookup. `session-lookup-service.js` adapts request cancellation and calls
`session-lookup-owner-service.js`. `auth.js` retains cookie parsing, token hashing,
current row interpretation, role checks, replay response and session issuance.

The owner checks out one ordinary pooled client, requires idle transaction status,
begins read-only Read Committed, applies local limits and reads authority. It
accepts a result only after clean ROLLBACK and release. Error, dirty transaction,
failed rollback or expired work cannot produce a session. After a normal SQL
timeout, acknowledged rollback restores the client for reuse without leaked local
settings. Uncertain clients are destroyed, awaited, then discarded.

The 8-second deadline starts before checkout. The shared `deadline-task-service.js`
separates caller result from work drainage and checks monotonic expiry. A late
checkout is still owned, receives no SQL, and is retired exactly once. This is
bounded by the ordinary native checkout timeout and pending cap; it is not a
forgotten promise race. Failed transport retirement keeps the checkout occupied
and its error listener attached until end; capacity is not falsely returned.

`database-client-retirement-service.js` isolates the reviewed pg 8.23.1 stream
destroy/end surface. Schema diagnostics reuse it and the generic deadline owner
through their existing policy adapters; their bounds and admission behavior stay
unchanged. The affected native schema lifecycle cohort must be rerun.

Request cancellation observes an unfinished response's `close`, not normal GET
request completion. Listeners retire after lookup. Session/database failures are
safe 503 errors with the original failure retained privately as cause. Existing
401/403 responses remain for completed invalid/insufficient-authority checks.
No cached successful session replaces a fresh read, and the client preserves its
authentication state on a retryable 503.

## Limits and next boundary

Local limits apply only to the session SELECT transaction. Login/password changes,
session rotation and rotated-token replay's revocation/audit writes retain their
existing owners and are not abandoned by the read deadline. Initial bootstrap
queries and ordinary active application SQL are not globally timed by this change.
There is no schema migration, snapshot edit, branch, tag or release.

The next security slice is transactional rotated-token replay handling: bound its
lock wait while preserving family revocation/audit authority and unknown-commit
semantics. Resource caps may cause deliberate 503 refusal under load; they are not
evidence of a universally sufficient production capacity.

See [official research/tradeoffs](POOL_SESSION_ADMISSION_RESEARCH.md) and
[validation outcome](POOL_SESSION_ADMISSION_OUTCOME.md).
