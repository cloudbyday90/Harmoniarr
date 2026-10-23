# Spectral interruption design

Decision date: October 23, 2026. Follows the [media lease outcome](MEDIA_LEASE_INTERRUPTION_OUTCOME.md).
See separate [research](SPECTRAL_INTERRUPTION_RESEARCH.md) and [outcome](SPECTRAL_INTERRUPTION_OUTCOME.md).

Forward an optional AbortSignal from the apply owner's existing interruption scope
through strict-quality proof, sampled hashing and the shared native spectral
analyzer. Check before dispatch and after awaited work, outside warning adapters.
Hash reads remain bounded positional reads; admitted reads and handle close drain.
Preserve Error/null through cleanup. Graceful shutdown remains separate.

The sidecar is a distinct durable queue, not an operation-run lease. Capture its
existing positive integer `attempts` immediately after claim as a monotonically
increasing claim generation. All repository claims increment it and no writer
resets it. Interrupted claims return to pending without decrementing the counter;
reusing a generation would reauthorize an older consumer. Repeated interruption
therefore consumes claim attempts under the existing failure cap. Fence completion,
failure and interrupted-batch release with job ID,
active state and captured generation. No migration or second queue is needed.
Poll current claim state once per second during preparation with the existing
serialized interruption scope. Stop/drain that observer before locked publication;
a completed job is no longer active and must not be mistaken for a lost claim.
Claim loss interrupts active native work but does
not authorize a stale failure or release. Upstream abort stops the batch after
drainage; finally attempt all exact captured releases, preserving the first error.

Prepare hashes/analysis outside transactions. Publication locks the current job
row, checks generation/state, writes the optional measurement and completes the
job on one queryable, then rechecks abort before commit. Cancellation observed
during that transaction rolls both writes back. An admitted COMMIT is not undone
by a later notification. Pre-add proof cache writes with a signal similarly use
a short transaction. Signals are notification, not replacement write authority.

Only successful owned completion can invoke the returned best-effort reputation
callback. This moves reputation after completion and prevents a refused stale
owner from penalizing a peer. Reputation is not atomic with cache/job commit;
callback failure or interruption after commit can omit advisory evidence. Existing
trust hooks may start their own advisory work and are not claimed fully drained.
Crash-safe exactly-once reputation delivery would require a separate outbox design.

Keep broad compatibility for no-signal public proof calls, existing classification,
cache keys and retroactive-job reputation exclusion. Test doubles must explicitly
implement claim ownership; production must not silently bypass missing guards.
Do not expand this change into fingerprint redesign or queue admission policy.

Prove stale requeue/reclaim refusal, pending batch cleanup, held hash/native close,
Error/null, cache-hit cancellation, transaction rollback and publication/requeue
ordering with actual PostgreSQL. Qualify real Linux spectral FFmpeg and owned
close separately. Run focused checks first, one stable full fast gate, affected
integration/native lanes and the preserved no-cache Docker walkthrough. Work on
main without release, tag, dependency, schema or version changes.

## Native reproduction

Use the owned disposable 3 GiB/two-CPU/256-PID Linux profile in the
[deployment memory design](DEPLOYMENT_MEMORY_DESIGN.md), retaining its source,
`testing/server` and provider-HTTPS fixture mounts. Add read-only mounts for
`test/native/spectral-interruption.test.js` and
`testing/integration/fixture-lifecycle.js`, then invoke
`npm run validate:native-spectral-interruption`. The profile guard refuses live
database/data binds before opening a pool. Retain logs and verify retirement of
only the exact owned container. Held claim loss uses the default one-second poll;
real FFmpeg cancellation begins after actual decoded spectral metadata arrives.
