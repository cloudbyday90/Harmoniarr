# Spectral claim and publication ownership

Use for pre-add spectral proof, sidecar analysis, sampled hashing, cache writes
or peer reputation after spectral classification. Read the
[design](../../../../docs/SPECTRAL_INTERRUPTION_DESIGN.md) and
[research](../../../../docs/SPECTRAL_INTERRUPTION_RESEARCH.md).

Producer capacity and library-file deduplication use the separate
[queue admission](queue-admission.md) workflow. Both spectral INSERT paths must
participate before their fresh capacity check. Claim/retry/recovery preserve
open count; a future terminal-to-open transition would need that admission too.

Trace apply quality preparation → proof → hasher/analyzer separately from the
sidecar queue. Reuse the operation-run interruption scope for the apply path and
pass the heartbeat signal to its returned advisory sidecar drain. Public proof
calls without a signal retain their normal behavior; this does not automatically
cancel every manual HTTP preparation or shutdown path.

For sidecar jobs, capture ID and positive attempt generation immediately after
claim. Every cooperating claim increments the counter; no writer may reset or
decrement it, including interruption cleanup. Reusing it could reauthorize an
older consumer.
Fence terminal writes and interrupted-batch release with active state and that
captured generation. A read observation is not publication authority. Missing
claim capabilities must fail closed, including in explicitly updated test doubles.

Poll only during preparation; stop/drain the observer before publication. A
successfully completed job is no longer active. Keep hash reads and FFmpeg outside
the row transaction, retain one propagated signal and await actual file-handle/
process close. Error/null must escape generic warning fallbacks and cleanup errors.

Lock the current claim for short transactional cache/job publication. Carry the
same queryable through both writes and check abort before commit. Retain all
captured batch releases after interruption, without touching replacement claims.
An admitted commit cannot be reversed by later abort notification.

Current spectral reputation uses [atomic publication](atomic-reputation.md): the
ledger and trust snapshot commit with cache/job completion. This replaces the
earlier post-commit durable callback described in the interruption baseline.
Only successful commit may invoke returned advisory hooks; do not claim durable
or exactly-once notification delivery or hidden descendant ownership. Retroactive
jobs must not penalize peers. Any required durable-write failure refuses publication.

Prove real PostgreSQL requeue/reclaim, stale-write refusal, cancellation rollback,
recovery lock wait, cache-hit refusal and returned callback ordering. Use
`validate:native-spectral-interruption` for Linux held-SIGTERM close and actual
spectral metadata before cancellation. Pair it with focused proof/hash/apply tests.
Keep cgroup sizing and shared admission lanes separate; these controls do not
establish a deployment minimum or whole-application quiescence.
