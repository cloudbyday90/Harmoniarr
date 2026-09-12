# Artist reads and reconciliation recovery

Date: September 12, 2026. Baseline: `5c0e0ed`.

## Read and command boundaries

Artist detail is a projection of metadata and saved operator intent. Its current projection calls failed-run recovery, which can enqueue a durable reconciliation run during GET. Remove that dependency and invocation. Repeated, concurrent, or prefetched reads must return the persisted failure/queue state without creating reconciliation or audit records. Retain `recovery: null` for response compatibility; the client uses latest, pending, and running state.

Deliberate Retry remains the existing fresh-session and CSRF-protected POST. Its 202 response means queued work, not completed reconciliation or acquired music. Preserve the existing worker's lease, cancellation, and maintenance behavior.

Automatic recovery belongs in durable background processing, independent of visiting the artist page. Preserve the existing policy of at most one `failure_recovery` run after an eligible failed run; do not automatically recover a failed recovery or a cancelled run. The existing dispatcher invokes a sweep after maintenance readiness, at most once per minute per process, considering at most ten failures at least sixty seconds old. This bounds batch size and cadence, not the query cost of a large operation history.

A separate recovery store rechecks the exact failed run, latest snapshot, active work, cancellation, and account eligibility in a transaction. It uses the same operator/artist advisory lock as policy saves and queue commands. Recovery inserts a new pending run and its system audit record atomically; it never replaces pending work. Candidate lock waits are short and skipped when busy, so a stalled artist save does not indefinitely block unrelated dispatch. Database failures are reported through the existing runtime error path, and ordinary queue claiming continues.

Disabled accounts are ineligible at the transactional check. Guarded PostgreSQL UUID casts recognize equivalent historical identifier spellings without throwing on malformed summaries. Each failed candidate is rolled back and reported while other candidates in that batch still get a recovery opportunity. The old projection recovery orchestrator and its obsolete unit tests are removed; tests target the active sweep/store policy instead.

## Alternatives and recommended stack

| Approach | Pros | Cons |
| --- | --- | --- |
| Pure reads and protected manual Retry | Predictable retrieval and clear user action; minimal protocol change | Terminal failures need operator attention |
| Pure reads plus bounded worker-owned recovery | Retains unattended recovery across restarts | Requires durable eligibility, concurrency, cancellation, and attempt-limit checks |
| Recovery triggered by GET | Apparent convenience | Navigation, polling, or prefetch can create operational work; rejected |

Recommend pure ESM projections, the existing protected command endpoint, modular background service/store files, PostgreSQL operation runs, the existing dispatcher and leases, and Vue's native Retry/status presentation. No new queue infrastructure, singleton, or custom ARIA widget is needed. Preserve the one-time recovery policy rather than broadening automatic retries.

## Official research

Discovered and read through research tools on September 12, 2026:

- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), section 9.2.1: GET's requested semantics are read-only; automated retrieval and prefetch must not initiate requested business mutations. Incidental logging differs from restarting reconciliation.
- [PostgreSQL SELECT](https://www.postgresql.org/docs/18/sql-select.html): `SKIP LOCKED` can serve queue consumers but does not provide a consistent reporting view.
- [PostgreSQL serialization failure handling](https://www.postgresql.org/docs/18/mvcc-serialization-failure-handling.html): retry complete transactions for retryable concurrency failures; do not indiscriminately retry persistent failures.
- [PostgreSQL information functions](https://www.postgresql.org/docs/17/functions-info.html): `pg_input_is_valid` supports guarding UUID casts when reading historical JSON summaries. Verification runs against the platform's PostgreSQL 18 baseline.
- [W3C form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/) and [button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/): use clear feedback, native activation, and appropriate focus behavior for an explicit Retry action.

Queue claiming does not imply exactly-once external effects. Existing idempotent request/materialization behavior and cancellation checks remain necessary. These design choices do not constitute a complete accessibility or security audit.

Maintenance readiness is checked before the sweep, with existing worker pause/cancellation behavior retained. This is not a new transactional fence against maintenance acquired mid-tick. Persistently busy entries at the front of a batch can delay later entries; large-history query performance and fair continuation are follow-up concerns. Eligible historical failures can now recover after startup without any artist-page visit.

## Acceptance

Prove repeated and concurrent GETs leave failed runs and audit counts unchanged. Prove protected POST still queues manual retry. Exercise automatic recovery without any page read, restart/repeated sweep deduplication, an already-failed recovery, active/newer work, and cancellation/maintenance boundaries. Keep separate outcome evidence for code, tests, PR review, Docker, and remaining recommendations.
