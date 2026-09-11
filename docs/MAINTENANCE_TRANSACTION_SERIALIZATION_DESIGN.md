# Maintenance checks that protect transactional writes

Design and verification date: September 11, 2026.

## Problem and outcome

An active-lock query did not protect the interval between the maintenance check and a database commit. A maintenance lock could be acquired while a collection decision waited for its request row lock, allowing that decision to commit after maintenance began.

Transactional write guards now ask the maintenance persistence service to acquire `LOCK TABLE maintenance_locks IN SHARE MODE` on the caller's transaction client before reading active locks. The table lock remains until commit or rollback. Ordinary status reads and callers without a transaction retain their existing behavior.

This protects both an empty active-lock result and existing expired rows: acquisition, renewal, release and deletion all modify the maintenance table and therefore serialize with guarded transactions. Concurrent guarded transactions can share the lock. PostgreSQL documents that SHARE conflicts with the ROW EXCLUSIVE lock taken by INSERT, UPDATE and DELETE, and that transaction locks remain until transaction end. The official URL was discovered through the documentation's version navigation and opened: [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html).

## Scope and lock order

The shared write guard enables the fence only when supplied a transaction client. The maintenance service rejects a fence request without that client; it cannot fall back to a pool read. PostgreSQL also requires an active transaction for this table-lock command.

Acquire the maintenance fence before application row locks. Collection intake initialization, page publication and failure publication follow that order, as do collection review mutations. External discovery now checks maintenance before the operation cancellation lookup and request lock. Candidate persistence invokes that guard before storing candidates. Repeated checks in the same transaction retain the existing fence.

The reviewed maintenance acquisition/release paths use standalone INSERT/UPDATE statements and do not acquire the write guard and then mutate maintenance rows on that same transaction. Future code must preserve that separation: two transactions attempting to upgrade a shared maintenance-table lock into a write lock can deadlock. Keep guarded transactions short and keep network work outside them.

## Alternatives and tradeoffs

| Option | Advantages | Costs |
| --- | --- | --- |
| Transactional SHARE table lock — implemented | Covers all maintenance-table writers automatically, including updates that reactivate expired locks; requires no schema migration or advisory-key convention. | Maintenance changes and table maintenance wait for guarded transactions. Consistent lock order is required. |
| Shared/exclusive advisory locks | Can isolate the guard from unrelated table operations. | Every maintenance mutation path must honor the same protocol; a missed writer reopens the race. |
| Recheck before commit | Small change. | Still leaves an interval between the final check and commit, so it cannot enforce serialization. |

The recommended stack remains the existing ESM service factories, same-client transaction runner and PostgreSQL locking. This change does not upgrade nontransactional callers into atomic writes; those require their own transaction boundary when appropriate.

## Validation

`node --test test/server/maintenance-lock-write-guard-service.test.js test/server/maintenance-lock-transaction-guard.test.js test/server/library-external-request-discovery-service.test.js` passed all 18 tests. Focused ESLint passed for every changed service and test.

`node --test --test-concurrency=1 test/integration/maintenance-lock-transaction-serialization.test.js` passed all three real PostgreSQL scenarios, with zero skips:

- A guarded durable write commits before a later maintenance acquisition, including repeated guards on its client.
- A maintenance acquisition already in progress completes first; the guarded check then rejects and no application write is persisted.
- Concurrent guarded transactions share the fence, while reactivating an expired lock waits for rollback and blocks the next write afterward.

The tests observe actual pending lock modes through [PostgreSQL pg_locks](https://www.postgresql.org/docs/18/view-pg-locks.html), rather than inferring blocking from a sleep. Explicit lock/query timeouts, bounded observation and unconditional rollback/client cleanup keep failure paths finite.
