# Queued-Worker Maintenance-Lock Pause Proof

Status: Implemented

## Context

Harmoniarr already had two layers of maintenance-lock protection:

- run-start routes reject unsafe manual starts while restore/maintenance locks
  are active;
- a claimed library scan worker can pause itself and return the run to
  `pending` without spending retry budget when a lock appears after claim.

The missing proof was the queue boundary before claim. A pending operation run
must remain unclaimed while a blocking maintenance lock is active, then become
claimable again after the lock is released. That behavior protects restore,
upgrade, and maintenance windows from background workers starting new work.

## Official Guidance Reviewed

As of June 2026:

- Node.js documents the built-in test runner used for integration coverage:
  <https://nodejs.org/api/test.html>
- PostgreSQL documents row-level locking and `SKIP LOCKED`, which Harmoniarr
  uses for concurrent queue claiming:
  <https://www.postgresql.org/docs/current/sql-select.html>
- PostgreSQL documents transaction isolation behavior relevant to queue claims:
  <https://www.postgresql.org/docs/current/transaction-iso.html>
- OWASP authorization guidance recommends deny-by-default server-side
  enforcement for privileged operations:
  <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>
- Docker Compose official guidance recommends reproducible, isolated service
  environments for local/integration validation:
  <https://docs.docker.com/compose/>

## Recommendation

Keep the pause decision in the existing dispatcher path:

1. `operation-queue-dispatcher` asks
   `maintenanceLockOperationPauseService.resolveDispatchReadiness()`.
2. The pause service reads active maintenance locks through
   `maintenanceLockService`.
3. If a blocking lock is present, the dispatcher returns a structured paused
   result and does not run stranded-run recovery or call
   `claimNextRunnableRun()`.
4. After the lock is released, the next dispatcher tick claims the same pending
   run through the existing PostgreSQL `FOR UPDATE SKIP LOCKED` queue store.

Do not push maintenance-lock checks down into every worker-specific queue store.
The dispatcher owns the shared "may new queued work start?" boundary, while
individual workers still keep their per-run interruption gate for locks that
appear after claim.

## Pros And Cons

| Option | Pros | Cons |
| --- | --- | --- |
| Prove pause/resume at the dispatcher integration boundary | Covers real database locks, pause service wiring, and queue claim behavior | Requires PostgreSQL-backed integration runtime |
| Rely only on dispatcher unit tests | Fast and isolated | Does not prove active locks from the database block real claims |
| Add lock checks to every queue store | Defense in depth | Duplicates policy and risks inconsistent pause messages |
| Keep dispatcher pause plus worker interruption gate | Clear ownership: no new claims during locks, already-claimed work can pause safely | Requires tests at both boundaries |

## Final Stack

- **Dispatch guard:** `createOperationQueueDispatcher` remains the shared gate
  for queue-side work. It checks maintenance-lock readiness before stranded-run
  recovery and queue claiming.
- **Pause service:** `createMaintenanceLockOperationPauseService` resolves
  blocking locks and returns structured pause metadata.
- **Queue store:** `createOperationQueueStore` still owns PostgreSQL claim
  semantics; it is only called when dispatch is allowed.
- **Worker safety:** worker interruption gates remain responsible for runs that
  are already claimed when a lock appears.
- **Integration proof:** `test/integration/operations-library-locks.test.js`
  now proves pending queued runs stay unclaimed while locked and are claimed
  after lock release.

## Outcome

- A restore maintenance lock causes the dispatcher tick to return
  `reason: 'paused'` and `pauseCode: 'recovery_lock_conflict'`.
- The pending run remains `pending`, unclaimed, and with `attempt_count = 0`.
- Stranded-run recovery is also skipped while the lock is active, so the
  dispatcher does not mutate operation-run state during the maintenance window.
- After lock release, the next tick claims the same run, increments
  `attempt_count`, records the dispatcher owner, and launches the matching
  handler.
- The dispatcher now evaluates maintenance-lock readiness before recovery, so
  the database-backed proof covers both queued claims and recovery-side
  mutations.

## Follow-Up

The next high-value item is Docker-backed execution of the remaining
deployment-path validation slice. The queue and worker pause behavior now has
database-backed integration proof; the release checklist still calls for live
Docker-capable validation of the deployment and restore paths.
