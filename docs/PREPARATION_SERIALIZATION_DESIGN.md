# Database preparation serialization design

## Ownership contract

One cooperating preparer owns a database-local session advisory lock before
reading bootstrap eligibility, capturing migration history or writing DDL.
The same physical client spans snapshot bootstrap, per-migration transactions,
failed-receipt handling and final status verification. A contender fails with
`database_preparation_busy`; it does not wait, inspect history or begin work.
There is no automatic retry and no new application/service, table or migration.

`database-preparation-lock-store.js` owns parameterized catalog/acquire/unlock
SQL. Its fixed two-integer key is `0x4841524d / 0x50524550` (HARM/PREP), in the
PostgreSQL two-integer advisory namespace. `database-preparation-owner-service.js`
owns checkout, admission, live scope identity, error/end listeners, unlock and
release. It uses a private WeakMap of active frozen contexts, allowing nested
bootstrap/migration calls to reuse an owner without a second checkout or stacked
lock. Forged, expired or unavailable scopes refuse before work.

`prepareDatabase` wraps the complete flow and passes the context into bootstrap
and migration execution. Standalone `bootstrapDatabaseSchemaFromSnapshot` and
`applyPendingMigrations` acquire the same owner themselves. Final status accepts
the captured queryable, avoiding another checkout even with pool max 1.
Independent diagnostic readers retain their existing read-only path.

The scope is internal trusted code. Callers await all work before returning and
must not launch detached/concurrent operations on its client. It requires physical
session affinity. Do not treat a transaction-pooled proxy as an interchangeable
deployment without a separate qualification of that connection contract.

## Admission and cleanup

Require an idle client. Inspect its own granted reserved key through pg_locks;
inherited or unrecognized ownership discards the connection without incrementing
an unknown acquisition count. Then call pg_try_advisory_lock once. Only a boolean
reply and idle state establish known acquisition or known contention.

| Stage/outcome | Behavior |
| --- | --- |
| Active/failed/unknown initial transaction | Refuse and discard; no ownership query or DDL |
| Inherited/unrecognized reserved key | Refuse and discard; no acquisition or work |
| Acquisition throws Error/null or reply is unrecognized | Discard; no unlock attempt or preparation work |
| Acquisition returns false | Busy error; return known idle client; no work or unlock |
| Work fails with Error/null | Preserve primary failure; unlock only on a usable idle connection |
| Connection error/end or non-idle final state | Refuse reuse/success; discard; do not issue an unsafe unlock query |
| Unlock returns true and idle | Return client to pool |
| Unlock throws or returns false/unrecognized | Explicit `database_preparation_unlock_unknown`; discard; no retry/history rewrite |
| Release also fails | Preserve the earlier work/unlock failure, including null |

Destroying a client initiates connection retirement. PostgreSQL releases session
locks when the backend actually ends; the application does not claim instantaneous
server retirement from a local pool count. Native replay waits for independent
server lock absence. Transaction status reports the last protocol state, so
connection error/end events have their own invalidation flag.

## Security and operational limits

The lock coordinates only code using this protocol and database. It does not
authorize maintenance, stop live workers, coordinate old binaries/external SQL,
or constrain arbitrary reviewed migration functions. Quiesce nonparticipants and
use the existing maintenance procedure. Do not use unlock_all to recover a live
session; it could remove another owner's locks. New ownership-coded errors use
fixed operator guidance and retain causes privately. Original acquisition/work
failures remain intact; the existing CLI boundary still owns their redaction.

Busy means retry after the active preparer finishes. An uncertain acquisition
means no preparation body was admitted, but the discarded backend may briefly
hold the key. An uncertain unlock can follow committed work: inspect through
`npm run diagnose:migrations` on an independent connection after writers settle,
rather than automatically rerunning. Existing failed-row consent and unknown
COMMIT policies remain in force.

This outer lock serializes preparation; it does not make the whole bootstrap or
migration batch one transaction. Historical SQL and schema snapshot bytes remain
unchanged. The snapshot contains 42 top-level BEGIN/COMMIT pairs and 115 ledger
inserts. The subsequent [atomic snapshot design](ATOMIC_SNAPSHOT_DESIGN.md)
compiles that artifact in memory and commits fresh bootstrap atomically while
preserving provenance. Normal pending batches still commit per migration.

## Validation plan

Unit tests cover live/nested/stale scopes, contention, inherited locks, initial
transaction states, Error/null precedence and uncertain cleanup. Native proof
uses max-1 pools, a fresh snapshot, two committed migration stages, an actual
second-migration lock wait, separate CLI processes, another database, backend
termination and real boolean-reply transport cuts at acquisition/unlock.
The existing lost-COMMIT fixture explicitly observes owner retirement before
reviewed replay. Full caller and packaged-runtime evidence belongs in the
separate [outcome](PREPARATION_SERIALIZATION_OUTCOME.md) and
[Docker outcome](LOCAL_DOCKER_PREPARATION_SERIALIZATION_OUTCOME.md).
