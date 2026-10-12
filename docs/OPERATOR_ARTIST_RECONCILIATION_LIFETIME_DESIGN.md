# Operator artist reconciliation lifetime design

Selected October 12, 2026 after metadata refresh ownership. Work stays on main,
uses ESM factories and shared lifecycle helpers, and creates no release or PR merge.
See the separate [research](OPERATOR_ARTIST_RECONCILIATION_LIFETIME_RESEARCH_2026_10.md).

## Problem and source boundaries

The reconciliation worker acknowledges queued work without returning completion.
It removes its active run before lease release and stops heartbeat scheduling
without draining admitted renewal. Application shutdown and both app fixtures
therefore cannot own this worker through its final database work.

Execution reads actor-scoped monitoring, selections, overrides and the requested
snapshot, checks its revision, builds desired state from current catalog/policy,
and awaits downstream request materialization. Two parallel read batches can
reject while siblings remain active. The called artist payload, monitoring and
snapshot-by-ID reads have the same nested failure boundary. Own these specific
read paths as well; do not claim every repository parallel read is covered.

Request materialization already awaits each same-client transaction, identity
advisory lock, duplicate lookup, request and required event, commit/rollback,
optional discovery reconciliation and client release. Completion of returned
discovery reconciliation is separate from execution of any subsequently queued
worker. Keep existing cancellation checkpoints and per-release transactions.

Snapshot lookup is scoped by user, artist and ID; revision validation does not
establish that current policy is still unchanged at publication. Worker status
and lease release are fenced by expected lease, but request materialization does
not receive that lease or lock/recompare the complete policy snapshot. Preserve
existing behavior in this lifetime slice; that authority gap needs separate
source-backed design and adverse PostgreSQL proof before adding new guards.

## Alternatives and decision

| Option | Pros | Cons / decision |
| --- | --- | --- |
| More fixture delay or status polling | Small change | Neither owns later reads, renewal or release; reject |
| Serialize all reads | Simple failure drainage | Loses existing independent-read concurrency; defer |
| Shared completion plus drained parallel batches | Preserves concurrency and exact failures; deterministic cleanup | Waits for admitted dependencies to settle; select |
| Forced abort or broad policy/transaction rewrite | Could provide new limits or authorization guarantees | Different partial-write/recovery semantics and larger scope; separate work |

Use the existing task lifecycle and lease cleanup helper. Return `{ completion }`
from the queued start; duplicate IDs share completion through final release.
Canonical terminal `close()` seals admission and drains work. Retain unexpected
acquisition Error/null, fixed null-domain fallback, expected unavailable/lost,
pause/cancellation, refused marks and existing result summaries.

A small ESM parallel-task helper accepts callbacks, observes synchronous and
asynchronous failure, waits for all returned tasks and then rethrows the first
observed rejection, including null. Results retain input order. Apply it only to
the traced execution batches and their nested read batches. It owns returned
promises, not hidden detached work or one globally consistent database snapshot.

Capture the reconciliation owner after metadata refresh (which can queue it),
before library discovery and import consumers. Production startup and both app
fixtures use the shared adapter. All known receivers are captured before awaits
and attempted after failure; retain the first failure. Keep the residual fixture
delay while other producers and workers remain unowned.

## Validation plan and recommendation stack

Retain original-source regressions for duplicate admission during held release
and fail-fast read drainage. Focused tests cover captured inputs, queued handler,
completion/close, Error/null precedence, renewal, cancellation, pause and refused
authority. Real PostgreSQL tests hold snapshot reads, required request-event
publication, returned discovery work and release across both app fixtures. Assert
committed request/event evidence, scoped snapshot/revision refusal and live owned
resources; release/drain all gates even after failure. No new deadlines or skips.

Review focused feedback before freezing source. Run complete fast validation and
the affected native group once for the stable candidate, with verified literal
paths. Document actual counts and timing limits in a separate outcome.

Recommended stack: captured actor/artist/snapshot → drained current input reads →
existing request/event transaction → returned discovery reconciliation → status,
renewal and captured lease finalization → application worker drain. Next evaluate
mutation-time policy/snapshot/lease fencing separately from completion ownership.
